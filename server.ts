import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { redis } from './lib/redis';
import Redis from 'ioredis';
import { checkPermission } from './lib/permissions';
import { checkRateLimit } from './lib/ratelimit';
import { z } from 'zod';
import * as cookie from 'cookie';
import { jwtVerify } from 'jose';
import { getPlaylistItems, searchYouTube, YouTubeSearchResult } from './lib/youtube';
import { logger } from './lib/logger';
import { selectSmartTrack, CandidateSong } from './lib/smartRadio';

const prisma = new PrismaClient();

// Handle Redis connection errors gracefully
redis.on('error', (err) => {
    if ((err as any).code !== 'ECONNREFUSED') {
        logger.error({ err, source: 'redis_client' }, 'Redis Client Error');
    }
});

// --- REDIS SUBSCRIBER ---
const redisSub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Subscribing to channels
redisSub.subscribe('global_announcements', 'admin_channel', 'ticket_updates', (err) => {
    if (err) {
        logger.error({ err, source: 'redis_sub' }, 'Failed to subscribe to channels');
    } else {
        logger.info({ source: 'redis_sub', channels: ['global_announcements', 'admin_channel', 'ticket_updates'] }, 'Redis Subscribed');
    }
});

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// --- AUTH HELPER FOR SOCKETS ---
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');

async function getUserIdFromSocket(socket: any): Promise<string | null> {
    try {
        const rawCookies = socket.handshake.headers.cookie;
        if (!rawCookies) return null;
        
        const parsed = cookie.parse(rawCookies);
        const token = parsed.session_token;
        if (!token) return null;

        const { payload } = await jwtVerify(token, JWT_SECRET);
        return (payload as any).userId;
    } catch (e) {
        return null;
    }
}

// --- ZOD SCHEMAS ---
const SessionIdSchema = z.string().min(1);
const SongDataSchema = z.object({
    id: z.string().min(1),
    title: z.string().max(255),
    artist: z.string().max(255),
    album: z.string().nullable().optional(),
    albumArtUrl: z.string().nullable().optional(),
    durationMs: z.number().nonnegative().optional().default(0),
});
const SuggestSchema = z.object({
    sessionId: SessionIdSchema,
    songData: SongDataSchema,
    suggestedBy: z.string().uuid().nullable().optional()
});
const BatchVoteSchema = z.object({
    sessionId: SessionIdSchema,
    queueItemIds: z.array(z.string().uuid()).min(1).max(50),
    voterId: z.string().min(1)
});
const PlayerUpdateSchema = z.object({
    sessionId: SessionIdSchema,
    state: z.object({
        status: z.enum(['playing', 'paused', 'buffering']),
        videoId: z.string(),
        position: z.number().nonnegative()
    }),
    voterId: z.string().uuid().optional() 
});
const TransitionSchema = z.object({
    sessionId: SessionIdSchema,
    prevId: z.string().uuid().nullable().optional(),
    nextId: z.string().uuid().nullable().optional(),
    voterId: z.string().uuid().optional()
});
const ControlSchema = z.object({
    sessionId: SessionIdSchema,
    queueItemId: z.string().uuid().optional(),
    voterId: z.string().uuid().optional()
});
const ForcePlaySchema = z.object({
    sessionId: SessionIdSchema,
    songData: SongDataSchema,
    voterId: z.string().uuid()
});
const ModSchema = z.object({
    itemId: z.string().uuid(),
    sessionId: SessionIdSchema
});
const ReactionSchema = z.object({
    sessionId: SessionIdSchema,
    type: z.enum(['fire', 'heart', 'party', 'poop']),
    voterId: z.string().optional()
});
const LiveChatMessageSchema = z.object({
    sessionId: SessionIdSchema,
    content: z.string().min(1).max(500),
    guestId: z.string().uuid().optional(), 
    isHostReply: z.boolean().default(false)
});

// --- STATE HELPERS ---
const getPlaybackState = async (sessionId: string) => {
    const key = `session_playback:${sessionId}`;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
};
const setPlaybackState = async (sessionId: string, state: any) => {
    const key = `session_playback:${sessionId}`;
    await redis.set(key, JSON.stringify(state));
    await redis.expire(key, 60 * 60 * 24); 
};

// --- HELPER: AUTO-ADD TO COLLECTION ---
const handleAutoAdd = async (sessionId: string, songId: string) => {
    try {
        const session = await prisma.voteSession.findUnique({
            where: { id: sessionId },
            select: { autoAddToCollectionId: true }
        });
        if (session && session.autoAddToCollectionId) {
            await prisma.collectionItem.create({
                data: { collectionId: session.autoAddToCollectionId, songId: songId }
            }).catch((err) => { if (err.code !== 'P2002') logger.error({ err, sessionId, songId }, "Auto-Add Error"); });
        }
    } catch (e) { logger.error({ err: e, sessionId, songId }, "Auto-Add Context Error"); }
};

// --- SMART RADIO LOGIC (PHASE 3 INTEGRATION) ---
const playRadioSong = async (sessionId: string) => {
    logger.info({ sessionId }, 'Attempting Radio Play');
    
    // 1. Guard: If queue has items, do nothing
    const queueCount = await prisma.queueItem.count({
        where: { voteSessionId: sessionId, status: 'LIVE' }
    });
    if (queueCount > 0) return null; 

    // 2. Load Session Config
    const session = await prisma.voteSession.findUnique({ where: { id: sessionId } });
    if (!session) return null;

    let candidates: CandidateSong[] = [];

    // 3. Strategy A: Collection (Highest Priority)
    if (session.backupCollectionId) {
        const items = await prisma.collectionItem.findMany({
            where: { collectionId: session.backupCollectionId },
            include: { song: true }
        });
        candidates = items.map(i => ({
            id: i.song.id,
            title: i.song.title,
            artist: i.song.artist,
            albumArtUrl: i.song.albumArtUrl,
            playCount: i.song.playCount,
            reactionCount: i.song.reactionCount
        }));
    }

    // 4. Strategy B: YouTube Playlist (Backup if Collection empty/unset)
    if (candidates.length === 0 && session.backupPlaylistId) {
        const cacheKey = `radio_playlist:${session.backupPlaylistId}`;
        let playlistItems: YouTubeSearchResult[] = [];
        const cached = await redis.get(cacheKey);
        
        if (cached) {
            playlistItems = JSON.parse(cached);
        } else {
            try {
                playlistItems = await getPlaylistItems(session.backupPlaylistId, session.hostId);
                if (playlistItems.length > 0) {
                    await redis.set(cacheKey, JSON.stringify(playlistItems));
                    await redis.expire(cacheKey, 60 * 60 * 24); 
                }
            } catch (e) { 
                logger.error({ err: e, sessionId }, "Radio Playlist Fetch Failed"); 
            }
        }

        if (playlistItems.length > 0) {
            // Fetch stats for these songs from DB to enable weighting
            const songIds = playlistItems.map(p => p.id);
            const knownSongs = await prisma.song.findMany({
                where: { id: { in: songIds } },
                select: { id: true, playCount: true, reactionCount: true }
            });
            const statsMap = new Map(knownSongs.map(s => [s.id, s]));

            candidates = playlistItems.map(p => {
                const stats = statsMap.get(p.id);
                return {
                    id: p.id,
                    title: p.title,
                    artist: p.artist,
                    albumArtUrl: p.albumArtUrl,
                    playCount: stats?.playCount || 0,
                    reactionCount: stats?.reactionCount || 0
                };
            });
        }
    }

    // 5. Strategy C: Session History (Last Resort)
    if (candidates.length === 0) {
        const historyItems = await prisma.queueItem.findMany({
            where: { voteSessionId: sessionId, status: 'PLAYED' },
            distinct: ['songId'],
            select: { song: true },
            orderBy: { updatedAt: 'desc' },
            take: 100 // Look back deeper for variety
        });
        
        candidates = historyItems.map(i => ({
            id: i.song.id,
            title: i.song.title,
            artist: i.song.artist,
            albumArtUrl: i.song.albumArtUrl,
            playCount: i.song.playCount,
            reactionCount: i.song.reactionCount
        }));
    }

    // 6. Get Recent History for Cooldown Logic
    const recentHistory = await prisma.queueItem.findMany({
        where: { voteSessionId: sessionId, status: 'PLAYED' },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        select: { songId: true }
    });

    // 7. Execute Smart Selection
    const selectedSong = selectSmartTrack(sessionId, candidates, recentHistory);

    if (!selectedSong) {
        logger.warn({ sessionId }, 'Radio failed to select a track (No candidates)');
        return null; 
    }

    // 8. Queue the Winner
    // Ensure Song exists in DB (needed if coming fresh from a Playlist)
    await prisma.song.upsert({
        where: { id: selectedSong.id },
        update: {},
        create: { 
            id: selectedSong.id, 
            title: selectedSong.title, 
            artist: selectedSong.artist, 
            album: 'Radio', 
            albumArtUrl: selectedSong.albumArtUrl, 
            durationMs: 0 
        }
    });

    const radioItem = await prisma.queueItem.create({
        data: { 
            voteSessionId: sessionId, 
            songId: selectedSong.id, 
            status: 'PLAYING', 
            voteCount: 0, 
            suggestedByGuestId: null, 
            isRadio: true 
        }
    });

    logger.info({ sessionId, songId: selectedSong.id }, 'Radio Song Started');
    return radioItem.id;
};

const broadcastState = async (io: Server, sessionId: string) => {
    const queue = await prisma.queueItem.findMany({
        where: { voteSessionId: sessionId, status: 'LIVE' },
        include: { song: true },
        orderBy: { voteCount: 'desc' }
    });
    const current = await prisma.queueItem.findFirst({
        where: { voteSessionId: sessionId, status: 'PLAYING' },
        include: { song: true }
    });
    const playbackState = await getPlaybackState(sessionId);
    io.to(sessionId).emit('state-update', { queue, current, playbackState });
};

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    const start = Date.now();
    try {
        const parsedUrl = parse(req.url!, true);
        await handle(req, res, parsedUrl);
        
        // --- LOG SUCCESSFUL REQUEST ---
        const duration = Date.now() - start;
        // Ignore static assets/next-internals to keep logs clean in prod
        if (!req.url?.startsWith('/_next') && !req.url?.startsWith('/favicon')) {
            logger.info({ 
                method: req.method, 
                url: req.url, 
                statusCode: res.statusCode, 
                duration 
            }, 'HTTP Request');
        }

    } catch (err) {
        if ((err as any).code === 'ECONNRESET' || (err as any).message === 'aborted') return;
        logger.error({ err, url: req.url }, 'Error handling HTTP request');
    }
  });

  const io = new Server(httpServer, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: { origin: '*' }
  });

  // --- PUB/SUB DISPATCHER ---
  redisSub.on('message', (channel, message) => {
    try {
        const data = JSON.parse(message);
        logger.debug({ channel, type: data.type }, 'Redis Pub/Sub Message Received');
        
        if (channel === 'global_announcements') {
            io.emit('global-announcement', data);
        } 
        else if (channel === 'admin_channel') {
            // General admin updates (like feedback)
            io.to('admin-room').emit('admin-update', data);
        }
        else if (channel === 'ticket_updates') {
            
            // 1. Live Chat Room Update
            if (data.ticketId) {
                io.to(`ticket:${data.ticketId}`).emit('ticket-update', data);
            }

            // 2. Admin Notification
            if (data.notifyAdmin) {
                io.to('admin-room').emit('admin-notification', data);
            }
            
            // 3. User Notification
            if (data.notifyUser && data.targetUserId) {
                io.to(`user:${data.targetUserId}`).emit('ticket-notification', data);
            }
        }
    } catch (e) {
        logger.error({ err: e, channel, message }, "Redis Pub/Sub Dispatch Error");
    }
  });

  io.on('connection', async (socket) => {
    redis.incr('system:active_connections');
    
    // Log connection with ID
    logger.info({ socketId: socket.id, ip: socket.handshake.address }, 'Socket Connected');

    // --- AUTO-JOIN ROOMS BASED ON AUTH ---
    const userId = await getUserIdFromSocket(socket);
    if (userId) {
        // 1. Join Personal Room
        socket.join(`user:${userId}`);
        logger.debug({ socketId: socket.id, userId }, 'User Authenticated & Joined Personal Room');

        // 2. Auto-Join Admin Room if SuperAdmin
        if (userId === process.env.SUPER_ADMIN_ID) {
            socket.join('admin-room');
            logger.info({ socketId: socket.id, userId }, 'SuperAdmin Joined Admin Room');
        }
    }

    socket.on('disconnect', () => {
        redis.decr('system:active_connections');
        logger.debug({ socketId: socket.id }, 'Socket Disconnected');
    });

    // --- EXPLICIT TICKET JOIN ---
    socket.on('join-ticket-room', async (ticketId) => {
        const socketUserId = await getUserIdFromSocket(socket);
        if (!socketUserId) return;
        
        socket.join(`ticket:${ticketId}`);
        logger.debug({ socketId: socket.id, ticketId }, 'Joined Ticket Room');
    });

    // --- JOIN ROOM ---
    socket.on('join-room', async (roomId) => {
      if (typeof roomId !== 'string' || roomId.length > 64) return;
      socket.join(roomId);
      try { await broadcastState(io, roomId); } catch (e) { logger.error({ err: e, roomId }, "Broadcast State Failed"); }
    });

    // --- HOST ROOM ---
    socket.on('join-host-room', async (roomId) => {
      if (typeof roomId !== 'string' || roomId.length > 64) return;
      const socketUserId = await getUserIdFromSocket(socket);
      if (!socketUserId) return;
      const host = await prisma.host.findUnique({ where: { id: socketUserId } });
      if (!host || host.isBanned || host.deletedAt) {
          socket.emit('error', 'Account suspended or deleted');
          socket.disconnect(true);
          return;
      }
      const session = await prisma.voteSession.findUnique({ 
          where: { id: roomId }, select: { hostId: true }
      });
      if (session && session.hostId === socketUserId) {
        socket.join(`host-${roomId}`);
        logger.info({ socketId: socket.id, roomId, userId: socketUserId }, 'Host Joined Session Room');
        try {
            const chats = await prisma.liveChatSession.findMany({
                where: { voteSessionId: roomId, hasUnreadForHost: true },
                include: { guest: { select: { username: true } }, messages: { orderBy: { createdAt: 'desc' }, take: 1 } }
            });
            socket.emit('live-chat-digest', chats);
        } catch(e) {}
        try {
            const pending = await prisma.queueItem.findMany({
                where: { voteSessionId: roomId, status: 'PENDING' },
                include: { song: true },
                orderBy: { createdAt: 'asc' }
            });
            socket.emit('pending-update', pending);
        } catch (e) { logger.error({ err: e, roomId }, "Host Room Init Failed"); }
      }
    });

    // --- LIVE CHAT (Guest <-> Host) ---
    socket.on('join-live-chat', async ({ sessionId, guestId }) => {
        if (!sessionId || !guestId) return;
        socket.join(`live-chat:${sessionId}:${guestId}`);
        await prisma.liveChatSession.updateMany({ where: { guestId }, data: { hasUnreadForGuest: false } });
        try {
            const chatSession = await prisma.liveChatSession.findUnique({
                where: { guestId },
                include: { messages: { orderBy: { createdAt: 'asc' }, take: 50 } }
            });
            if (chatSession) socket.emit('chat-history', chatSession.messages);
        } catch(e) {}
    });

    socket.on('send-live-chat-message', async (rawPayload) => {
        const result = LiveChatMessageSchema.safeParse(rawPayload);
        if (!result.success) return;
        const { sessionId, content, guestId, isHostReply } = result.data;
        const identifier = guestId || socket.handshake.address;
        if (!(await checkRateLimit(`chat:${identifier}`, 10, 10))) { socket.emit('error', 'Chatting too fast'); return; }
        try {
            const validGuestId = guestId || ''; 
            if(!validGuestId) return;
            let chatSession = await prisma.liveChatSession.findUnique({ where: { guestId: validGuestId } });
            if (!chatSession) {
                chatSession = await prisma.liveChatSession.create({ data: { voteSessionId: sessionId, guestId: validGuestId } });
            }
            const message = await prisma.liveChatSession.update({
                where: { id: chatSession.id },
                data: {
                    hasUnreadForHost: !isHostReply,
                    hasUnreadForGuest: isHostReply,
                    updatedAt: new Date(),
                    messages: {
                        create: { content, isFromGuest: !isHostReply }
                    }
                },
                select: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } }
            }).then(r => r.messages[0]);

            const roomKey = `live-chat:${sessionId}:${validGuestId}`;
            io.to(roomKey).emit('live-chat-message', message);
            if (!isHostReply) {
                const guestInfo = await prisma.guestAccount.findUnique({ where: { id: validGuestId }, select: { username: true }});
                io.to(`host-${sessionId}`).emit('host-chat-alert', { sessionId, guestId: validGuestId, guestName: guestInfo?.username, lastMessage: message, unreadCount: 1 });
            }
        } catch (e) { logger.error({ err: e, sessionId, guestId }, "Chat Error"); }
    });

    // --- REACTION HANDLER (UPDATED FOR SMART RADIO) ---
    socket.on('send-reaction', async (rawPayload) => {
        const result = ReactionSchema.safeParse(rawPayload);
        if (!result.success) return;
        const { sessionId, type, voterId } = result.data;
        const limitId = voterId || socket.handshake.address;
        
        // 1. Rate Limiting
        if (!(await checkRateLimit(`react:${limitId}`, 10, 5))) return;

        // 2. Check Feature Flag
        const session = await prisma.voteSession.findUnique({ where: { id: sessionId }, select: { enableReactions: true }});
        if (!session?.enableReactions) return;

        // 3. Broadcast Animation immediately (Optimistic UI)
        io.to(sessionId).emit('reaction', { type, id: Date.now() });

        // 4. Update Database for Smart Radio (Async, non-blocking)
        try {
            // Find current song
            const playingItem = await prisma.queueItem.findFirst({
                where: { voteSessionId: sessionId, status: 'PLAYING' },
                select: { id: true, songId: true }
            });

            if (playingItem) {
                // Increment Specific Play Count
                await prisma.queueItem.update({
                    where: { id: playingItem.id },
                    data: { reactionCount: { increment: 1 } }
                });

                // Increment Global Song Engagement
                await prisma.song.update({
                    where: { id: playingItem.songId },
                    data: { reactionCount: { increment: 1 } }
                });
                
                logger.debug({ sessionId, songId: playingItem.songId, type }, 'Reaction Persisted');
            }
        } catch (e) {
            // Log but don't crash socket
            logger.error({ err: e, sessionId }, "Failed to persist reaction");
        }
    });

    socket.on('player-update', async (rawPayload) => {
        const result = PlayerUpdateSchema.safeParse(rawPayload);
        if (!result.success) return;
        const { sessionId, state, voterId } = result.data;
        if (!voterId || !(await checkPermission(sessionId, voterId, 'controlPlayer'))) return;
        if (!(await checkRateLimit(`sync:${voterId}`, 10, 2))) return;
        try {
            const now = Date.now();
            let storageState;
            if (state.status === 'playing') {
                const startTime = now - (state.position * 1000);
                storageState = { status: 'playing', videoId: state.videoId, startTime: startTime, timestamp: now };
            } else {
                storageState = { status: 'paused', videoId: state.videoId, currentPosition: state.position * 1000, timestamp: now };
            }
            await setPlaybackState(sessionId, storageState);
            socket.broadcast.to(sessionId).emit('player-sync', storageState);
        } catch (e) { logger.error({ err: e, sessionId }, "Player Sync Error"); }
    });

    socket.on('suggest-song', async (rawPayload) => {
      const result = SuggestSchema.safeParse(rawPayload);
      if (!result.success) { socket.emit('error', 'Invalid song data format'); return; }
      const { sessionId, songData, suggestedBy } = result.data;
      const identifier = suggestedBy || socket.handshake.address || socket.id;
      if (!(await checkRateLimit(`suggest:${identifier}`, 5, 60))) { socket.emit('error', 'You are suggesting too fast.'); return; }
      try {
        const session = await prisma.voteSession.findUnique({ where: { id: sessionId } });
        if (!session || !session.isActive) return;
        const blacklist = await prisma.blacklist.findMany({ where: { hostId: session.hostId } });
        const isBanned = blacklist.some(item => {
            if (item.type === 'SONG_ID') return item.value === songData.id;
            if (item.type === 'KEYWORD') {
                const text = `${songData.title} ${songData.artist}`.toLowerCase();
                return text.includes(item.value.toLowerCase());
            }
            return false;
        });
        if (isBanned) { socket.emit('error', 'This song is blocked by the host.'); return; }
        let forcePending = false;
        if (session.enableDuplicateCheck) {
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
            const recentlyPlayed = await prisma.queueItem.findFirst({
                where: { voteSessionId: sessionId, songId: songData.id, updatedAt: { gt: twoHoursAgo }, status: 'PLAYED' }
            });
            if (recentlyPlayed) { forcePending = true; socket.emit('error', 'Played recently. Sent to host for approval.'); }
        }
        if (session.enableRegionCheck) {
            try {
                const [details] = await searchYouTube(`https://youtube.com/watch?v=${songData.id}`, session.hostId, true);
                if (details && details.isPlayable === false) { socket.emit('error', 'This song is region-locked.'); return; }
            } catch (err) {}
        }
        await prisma.song.upsert({
          where: { id: songData.id },
          update: {},
          create: { id: songData.id, title: songData.title, artist: songData.artist, album: songData.album || 'Unknown', albumArtUrl: songData.albumArtUrl, durationMs: songData.durationMs || 0 }
        });
        const existing = await prisma.queueItem.findFirst({
          where: { voteSessionId: sessionId, songId: songData.id, status: { in: ['LIVE', 'PLAYING', 'PENDING'] } }
        });
        if (existing) { socket.emit('error', 'Song already in queue'); return; }
        const status = (session.requireVerification || forcePending) ? 'PENDING' : 'LIVE';
        let validGuestId = null;
        if (suggestedBy) {
            const guest = await prisma.guestAccount.findUnique({ where: { id: suggestedBy } });
            if (guest && !guest.isBanned) validGuestId = suggestedBy;
        }
        await prisma.queueItem.create({
          data: { voteSessionId: sessionId, songId: songData.id, status: status, suggestedByGuestId: validGuestId, isRadio: false }
        });
        logger.info({ sessionId, songId: songData.id, suggestedBy }, 'Song Suggested');
        if (status === 'LIVE') {
          await broadcastState(io, sessionId);
        } else {
            const pending = await prisma.queueItem.findMany({
                where: { voteSessionId: sessionId, status: 'PENDING' },
                include: { song: true },
                orderBy: { createdAt: 'asc' }
            });
            io.to(`host-${sessionId}`).emit('pending-update', pending);
        }
      } catch (e) { logger.error({ err: e, sessionId, songId: songData.id }, "Suggest Error"); }
    });

    socket.on('batch-vote', async (rawPayload) => {
        const result = BatchVoteSchema.safeParse(rawPayload);
        if (!result.success) return;
        const { sessionId, queueItemIds, voterId } = result.data;
        const lockKey = `vote_lock:${sessionId}:${voterId}`;
        const isLocked = await redis.set(lockKey, 'locked', 'EX', 5, 'NX'); 
        if (!isLocked) { socket.emit('error', 'Processing previous vote.'); return; }
        try {
            const session = await prisma.voteSession.findUnique({ where: { id: sessionId } });
            if (!session) return;
            const historyKey = `session_votes:${sessionId}:${voterId}`;
            const cooldownKey = `session_cooldown:${sessionId}:${voterId}`;
            const ttl = await redis.ttl(cooldownKey);
            if (ttl > 0) { socket.emit('error', `Round active. Wait ${Math.ceil(ttl / 60)}m.`); return; }
            const currentVoteCount = await redis.scard(historyKey);
            if ((currentVoteCount + queueItemIds.length) > session.votesPerUser) { socket.emit('error', `Limit reached.`); return; }
            const alreadyVotedFor = await redis.smismember(historyKey, ...queueItemIds);
            const newVotes = queueItemIds.filter((_, index) => alreadyVotedFor[index] === 0);
            if (newVotes.length === 0) return;
            const updatePromises = newVotes.map(id => prisma.queueItem.update({ where: { id }, data: { voteCount: { increment: 1 } } }));
            await prisma.$transaction(updatePromises);
            await redis.sadd(historyKey, ...newVotes);
            if (session.cycleDelay > 0) await redis.setex(cooldownKey, session.cycleDelay * 60, '1');
            await broadcastState(io, sessionId);
            socket.emit('vote-success', { confirmedIds: newVotes, cooldownSeconds: session.cycleDelay * 60 });
        } catch (e) { logger.error({ err: e, sessionId, voterId }, "Batch Vote Error"); } finally { await redis.del(lockKey); }
    });

    socket.on('song-transition', async (rawPayload) => {
        const result = TransitionSchema.safeParse(rawPayload);
        if (!result.success) return;
        const { sessionId, prevId, nextId, voterId } = result.data;
        if (!voterId || !(await checkPermission(sessionId, voterId, 'controlPlayer'))) return;
        try {
            const ops = [];
            if (prevId) {
                const prevItem = await prisma.queueItem.findUnique({ where: { id: prevId } });
                if (prevItem) {
                    await prisma.song.update({ where: { id: prevItem.songId }, data: { playCount: { increment: 1 } } });
                    handleAutoAdd(sessionId, prevItem.songId);
                    if (prevItem.suggestedByGuestId) await prisma.guestAccount.update({ where: { id: prevItem.suggestedByGuestId }, data: { karma: { increment: 10 } }});
                }
                ops.push(prisma.queueItem.update({ where: { id: prevId }, data: { status: 'PLAYED' } }));
            }
            let newPlayingId = nextId;
            if (nextId) ops.push(prisma.queueItem.update({ where: { id: nextId }, data: { status: 'PLAYING' } }));
            if (ops.length > 0) await prisma.$transaction(ops);
            if (!newPlayingId) newPlayingId = await playRadioSong(sessionId);
            if (newPlayingId) {
                const song = await prisma.queueItem.findUnique({ where: { id: newPlayingId }, select: { songId: true }});
                if(song) await setPlaybackState(sessionId, { status: 'playing', videoId: song.songId, startTime: Date.now(), timestamp: Date.now() });
            } else { await redis.del(`session_playback:${sessionId}`); }
            await broadcastState(io, sessionId);
        } catch (e) { logger.error({ err: e, sessionId }, "Transition Error"); }
    });

   socket.on('song-started', async (rawPayload) => {
        const result = ControlSchema.safeParse(rawPayload);
        if (!result.success) return;
        const { sessionId, queueItemId, voterId } = result.data;
        if (!queueItemId || !voterId || !(await checkPermission(sessionId, voterId, 'controlPlayer'))) return;
        try {
            const currentlyPlaying = await prisma.queueItem.findMany({ where: { voteSessionId: sessionId, status: 'PLAYING' } });
            for (const item of currentlyPlaying) {
                handleAutoAdd(sessionId, item.songId);
                await prisma.song.update({ where: { id: item.songId }, data: { playCount: { increment: 1 } } });
            }
            await prisma.queueItem.updateMany({ where: { voteSessionId: sessionId, status: 'PLAYING' }, data: { status: 'PLAYED' } });
            await prisma.queueItem.update({ where: { id: queueItemId }, data: { status: 'PLAYING' } });
            const song = await prisma.queueItem.findUnique({ where: { id: queueItemId }, select: { songId: true }});
            if (song) await setPlaybackState(sessionId, { status: 'playing', videoId: song.songId, startTime: Date.now(), timestamp: Date.now() });
            await broadcastState(io, sessionId);
        } catch (e) { logger.error({ err: e, sessionId }, "Song Start Error"); }
    });

    socket.on('song-ended', async (rawPayload) => {
        const result = ControlSchema.safeParse(rawPayload);
        if (!result.success) return;
        const { sessionId, queueItemId, voterId } = result.data;
        if (!queueItemId || !voterId || !(await checkPermission(sessionId, voterId, 'controlPlayer'))) return;
        try {
            await prisma.queueItem.update({ where: { id: queueItemId }, data: { status: 'PLAYED' } });
            const item = await prisma.queueItem.findUnique({ where: { id: queueItemId } });
            if (item) {
                await prisma.song.update({ where: { id: item.songId }, data: { playCount: { increment: 1 } } });
                await handleAutoAdd(sessionId, item.songId);
                if (item.suggestedByGuestId) await prisma.guestAccount.update({ where: { id: item.suggestedByGuestId }, data: { karma: { increment: 10 } }});
            }
            await redis.del(`session_playback:${sessionId}`);
            await broadcastState(io, sessionId);
        } catch (e) { logger.error({ err: e, sessionId }, "Song End Error"); }
    });

    socket.on('song-back', async (rawPayload) => {
        const result = ControlSchema.safeParse(rawPayload);
        if (!result.success) return;
        const { sessionId, voterId } = result.data;
        if (!voterId || !(await checkPermission(sessionId, voterId, 'controlPlayer'))) return;
        try {
            const current = await prisma.queueItem.findFirst({ where: { voteSessionId: sessionId, status: 'PLAYING' } });
            const previous = await prisma.queueItem.findFirst({ where: { voteSessionId: sessionId, status: 'PLAYED' }, orderBy: { updatedAt: 'desc' } });
            if (!previous) return; 
            const ops = [];
            if (current) ops.push(prisma.queueItem.update({ where: { id: current.id }, data: { status: 'LIVE' } }));
            ops.push(prisma.queueItem.update({ where: { id: previous.id }, data: { status: 'PLAYING' } }));
            await prisma.$transaction(ops);
            await setPlaybackState(sessionId, { status: 'playing', videoId: previous.songId, startTime: Date.now(), timestamp: Date.now() });
            await broadcastState(io, sessionId);
        } catch (e) { logger.error({ err: e, sessionId }, "Song Back Error"); }
    });

    socket.on('force-play', async (rawPayload) => {
        const result = ForcePlaySchema.safeParse(rawPayload);
        if (!result.success) return;
        const { sessionId, songData, voterId } = result.data;
        if (!voterId || !(await checkPermission(sessionId, voterId, 'forcePlay'))) return;
        try {
            await prisma.song.upsert({ where: { id: songData.id }, update: {}, create: { id: songData.id, title: songData.title, artist: songData.artist, album: 'Force Played', albumArtUrl: songData.albumArtUrl, durationMs: 0 } });
            const currentlyPlaying = await prisma.queueItem.findMany({ where: { voteSessionId: sessionId, status: 'PLAYING' } });
            for(const item of currentlyPlaying) { await prisma.song.update({ where: { id: item.songId }, data: { playCount: { increment: 1 } } }); }
            await prisma.queueItem.updateMany({ where: { voteSessionId: sessionId, status: 'PLAYING' }, data: { status: 'PLAYED' } });
            const existing = await prisma.queueItem.findFirst({ where: { voteSessionId: sessionId, status: 'LIVE', songId: songData.id } });
            if (existing) { await prisma.queueItem.update({ where: { id: existing.id }, data: { status: 'PLAYING', voteCount: 999 } }); } 
            else { await prisma.queueItem.create({ data: { voteSessionId: sessionId, songId: songData.id, status: 'PLAYING', voteCount: 999, isRadio: false } }); }
            await setPlaybackState(sessionId, { status: 'playing', videoId: songData.id, startTime: Date.now(), timestamp: Date.now() });
            logger.warn({ sessionId, songId: songData.id, voterId }, 'Force Play Executed');
            await broadcastState(io, sessionId);
        } catch (e) { logger.error({ err: e, sessionId }, "Force Play Error"); }
    });

    socket.on('remove-song', async (rawPayload) => {
        const result = ControlSchema.safeParse(rawPayload);
        if (!result.success || !result.data.queueItemId) return;
        const { sessionId, queueItemId, voterId } = result.data;
        if (!voterId || !(await checkPermission(sessionId, voterId, 'manageQueue'))) return;
        try { await prisma.queueItem.update({ where: { id: queueItemId }, data: { status: 'REJECTED' } }); await broadcastState(io, sessionId); } catch (e) { logger.error({err:e, sessionId}, "Remove Song Error"); }
    });

    socket.on('ban-suggester', async (rawPayload) => {
        const result = ControlSchema.safeParse(rawPayload);
        if (!result.success || !result.data.queueItemId) return;
        const { sessionId, queueItemId, voterId } = result.data;
        if (!voterId || !(await checkPermission(sessionId, voterId, 'manageUsers'))) return;
        try {
            const item = await prisma.queueItem.findUnique({ where: { id: queueItemId }, include: { guest: true } });
            if (item && item.suggestedByGuestId) {
                await prisma.guestAccount.update({ where: { id: item.suggestedByGuestId }, data: { isBanned: true } });
                await prisma.queueItem.update({ where: { id: queueItemId }, data: { status: 'REJECTED' } });
                await broadcastState(io, sessionId);
                logger.warn({ sessionId, bannedGuestId: item.suggestedByGuestId, bannedBy: voterId }, 'User Banned from Queue');
            }
        } catch (e) { logger.error({err:e, sessionId}, "Ban Suggester Error"); }
    });

    socket.on('admin-reset-timer', async (rawPayload) => {
        const result = z.object({ sessionId: SessionIdSchema, targetUserId: z.string().optional(), voterId: z.string().uuid() }).safeParse(rawPayload);
        if (!result.success) return;
        const { sessionId, targetUserId, voterId } = result.data;
        if (!voterId || !(await checkPermission(sessionId, voterId, 'manageUsers'))) return;
        try {
            if (targetUserId) {
                await redis.del(`session_votes:${sessionId}:${targetUserId}`, `session_cooldown:${sessionId}:${targetUserId}`);
                io.to(sessionId).emit('timer-reset', { targetUserId });
            } else {
                const guests = await prisma.guestAccount.findMany({ where: { voteSessionId: sessionId } });
                const session = await prisma.voteSession.findUnique({ where: { id: sessionId }});
                const allIds = [session?.hostId, ...guests.map(g => g.id)].filter(Boolean) as string[];
                const keysToDelete = [];
                for (const id of allIds) { keysToDelete.push(`session_votes:${sessionId}:${id}`, `session_cooldown:${sessionId}:${id}`); }
                if (keysToDelete.length > 0) await redis.del(...keysToDelete);
                io.to(sessionId).emit('timer-reset', { targetUserId: null });
            }
        } catch (e) { logger.error({err:e, sessionId}, "Timer Reset Error"); }
    });

    socket.on('clear-session', async (rawPayload) => {
        const result = ControlSchema.safeParse(rawPayload);
        if (!result.success) return;
        const { sessionId, voterId } = result.data;
        if (!voterId || !(await checkPermission(sessionId, voterId, 'manageQueue'))) return;
        try {
            await prisma.queueItem.deleteMany({ where: { voteSessionId: sessionId } });
            await redis.del(`session_playback:${sessionId}`);
            await broadcastState(io, sessionId);
            io.to(sessionId).emit('session-cleared');
            logger.warn({ sessionId, clearedBy: voterId }, 'Session Cleared');
        } catch (e) { logger.error({err:e, sessionId}, "Clear Session Error"); }
    });

    socket.on('approve-song', async (rawPayload) => {
        const result = ModSchema.safeParse(rawPayload);
        if (!result.success) return;
        const { itemId, sessionId } = result.data;
        try {
            await prisma.queueItem.update({ where: { id: itemId }, data: { status: 'LIVE' } });
            await broadcastState(io, sessionId);
            const pending = await prisma.queueItem.findMany({ where: { voteSessionId: sessionId, status: 'PENDING' }, include: { song: true }, orderBy: { createdAt: 'asc' } });
            io.to(`host-${sessionId}`).emit('pending-update', pending);
        } catch(e) { logger.error({err:e, sessionId}, "Approve Song Error"); }
    });

    socket.on('reject-song', async (rawPayload) => {
        const result = ModSchema.safeParse(rawPayload);
        if (!result.success) return;
        const { itemId, sessionId } = result.data;
        try {
            await prisma.queueItem.update({ where: { id: itemId }, data: { status: 'REJECTED' } });
            const pending = await prisma.queueItem.findMany({ where: { voteSessionId: sessionId, status: 'PENDING' }, include: { song: true }, orderBy: { createdAt: 'asc' } });
            io.to(`host-${sessionId}`).emit('pending-update', pending);
        } catch(e) { logger.error({err:e, sessionId}, "Reject Song Error"); }
    });

    socket.on('disconnect', () => {});
  });

  httpServer.listen(port, () => {
    logger.info({ port, hostname }, 'Server Ready');
  });
});