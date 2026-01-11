import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { redis } from './lib/redis';
import Redis from 'ioredis'; // Need distinct client for Sub
import { checkPermission } from './lib/permissions';
import { checkRateLimit } from './lib/ratelimit';
import { z } from 'zod';
import * as cookie from 'cookie';
import { jwtVerify } from 'jose';
import { getPlaylistItems, searchYouTube, YouTubeSearchResult } from './lib/youtube';

const prisma = new PrismaClient();

// Handle Redis connection errors gracefully
redis.on('error', (err) => {
    if ((err as any).code !== 'ECONNREFUSED') {
        console.error('Redis Client Error', err);
    }
});

// --- REDIS SUBSCRIBER FOR GLOBAL ANNOUNCEMENTS ---
// We need a separate connection because a client in Subscribe mode cannot issue commands
const redisSub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redisSub.subscribe('global_announcements', (err) => {
    if (err) console.error('Failed to subscribe to announcements', err);
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
                data: {
                    collectionId: session.autoAddToCollectionId,
                    songId: songId
                }
            }).catch((err) => {
                // Ignore unique constraint violations (duplicates) silently
                if (err.code !== 'P2002') {
                   console.error("Auto-Add Error", err);
                }
            });
        }
    } catch (e) {
        console.error("Auto-Add Context Error", e);
    }
};

/**
 * SMART RADIO LOGIC
 */
const playRadioSong = async (sessionId: string) => {
    // 1. Check if Queue has items
    const queueCount = await prisma.queueItem.count({
        where: { voteSessionId: sessionId, status: 'LIVE' }
    });

    if (queueCount > 0) return null; 

    const session = await prisma.voteSession.findUnique({ 
        where: { id: sessionId } 
    });
    if (!session) return null;

    let selectedSong: { id: string, title: string, artist: string, albumArtUrl: string | null } | null = null;

    // 2. Try Internal Collection (Preferred)
    if (session.backupCollectionId) {
        const items = await prisma.collectionItem.findMany({
            where: { collectionId: session.backupCollectionId },
            include: { song: true }
        });

        if (items.length > 0) {
            const lastPlayed = await prisma.queueItem.findFirst({
                where: { voteSessionId: sessionId, status: 'PLAYED' },
                orderBy: { updatedAt: 'desc' }
            });

            let pool = items;
            if (lastPlayed && pool.length > 1) {
                pool = pool.filter(i => i.songId !== lastPlayed.songId);
            }
            if (pool.length === 0) pool = items;

            const randomItem = pool[Math.floor(Math.random() * pool.length)];
            selectedSong = randomItem.song;
        }
    }

    // 3. Try YouTube Backup Playlist
    if (!selectedSong && session.backupPlaylistId) {
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
                console.error("Radio Playlist Fetch Failed", e);
            }
        }

        if (playlistItems.length > 0) {
            const lastPlayed = await prisma.queueItem.findFirst({
                where: { voteSessionId: sessionId, status: 'PLAYED' },
                orderBy: { updatedAt: 'desc' }
            });

            let pool = playlistItems;
            if (lastPlayed && pool.length > 1) {
                pool = pool.filter(p => p.id !== lastPlayed.songId);
            }
            if (pool.length === 0) pool = playlistItems;

            const randomTrack = pool[Math.floor(Math.random() * pool.length)];
            selectedSong = {
                id: randomTrack.id,
                title: randomTrack.title,
                artist: randomTrack.artist,
                albumArtUrl: randomTrack.albumArtUrl
            };
        }
    }

    // 4. Fallback: Smart History
    if (!selectedSong) {
        const history = await prisma.queueItem.findMany({
            where: { voteSessionId: sessionId, status: 'PLAYED' },
            select: { songId: true, song: true },
            orderBy: { updatedAt: 'desc' },
            take: 50 
        });

        if (history.length > 0) {
            const bufferSize = Math.min(5, Math.floor(history.length * 0.5));
            const recentIds = new Set(history.slice(0, bufferSize).map(h => h.songId));
            
            const allPlayedIds = await prisma.queueItem.findMany({
                where: { voteSessionId: sessionId, status: 'PLAYED' },
                select: { songId: true, song: true },
                distinct: ['songId']
            });

            const validPool = allPlayedIds.filter(item => !recentIds.has(item.songId));
            const finalPool = validPool.length > 0 ? validPool : (allPlayedIds.length > 1 ? allPlayedIds.slice(1) : allPlayedIds);
            
            if (finalPool.length > 0) {
                const randomItem = finalPool[Math.floor(Math.random() * finalPool.length)];
                selectedSong = randomItem.song;
            }
        }
    }

    if (!selectedSong) return null; 

    // Upsert Song Metadata
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

    // Create item marked as RADIO
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
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: { origin: '*' }
  });

  // --- PUB/SUB HANDLER ---
  redisSub.on('message', (channel, message) => {
    if (channel === 'global_announcements') {
        try {
            const data = JSON.parse(message);
            // Broadcast to everyone connected
            io.emit('global-announcement', data);
        } catch (e) {
            console.error("Announcement Broadcast Error", e);
        }
    }
  });

  io.on('connection', (socket) => {
    
    // --- JOIN LOGIC ---
    socket.on('join-room', async (roomId) => {
      if (typeof roomId !== 'string' || roomId.length > 64) return;
      socket.join(roomId);
      try { await broadcastState(io, roomId); } catch (e) { console.error(e); }
    });

    socket.on('join-host-room', async (roomId) => {
      if (typeof roomId !== 'string' || roomId.length > 64) return;

      const userId = await getUserIdFromSocket(socket);
      if (!userId) return;

      const session = await prisma.voteSession.findUnique({ 
          where: { id: roomId },
          select: { hostId: true }
      });

      if (session && session.hostId === userId) {
        socket.join(`host-${roomId}`);
        try {
            const pending = await prisma.queueItem.findMany({
                where: { voteSessionId: roomId, status: 'PENDING' },
                include: { song: true },
                orderBy: { createdAt: 'asc' }
            });
            socket.emit('pending-update', pending);
        } catch (e) { console.error(e); }
      }
    });

    // --- REACTION LOGIC ---
    socket.on('send-reaction', async (rawPayload) => {
        const result = ReactionSchema.safeParse(rawPayload);
        if (!result.success) return;
        const { sessionId, type, voterId } = result.data;

        // Use IP fallback if no voterId (Host)
        const limitId = voterId || socket.handshake.address;
        
        // Rate limit: 10 per 5 seconds
        if (!(await checkRateLimit(`react:${limitId}`, 10, 5))) return;

        const session = await prisma.voteSession.findUnique({ where: { id: sessionId }, select: { enableReactions: true }});
        if (!session?.enableReactions) return;

        // Broadcast to everyone in room, including sender
        io.to(sessionId).emit('reaction', { type, id: Date.now() });
    });

    // --- PLAYER SYNC ---
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
                storageState = {
                    status: 'playing',
                    videoId: state.videoId,
                    startTime: startTime,
                    timestamp: now 
                };
            } else {
                storageState = {
                    status: 'paused',
                    videoId: state.videoId,
                    currentPosition: state.position * 1000,
                    timestamp: now
                };
            }

            await setPlaybackState(sessionId, storageState);
            socket.broadcast.to(sessionId).emit('player-sync', storageState);

        } catch (e) { console.error("Player Sync Error", e); }
    });

    // --- SONG SUGGESTION (Soft Duplicate Check) ---
    socket.on('suggest-song', async (rawPayload) => {
      const result = SuggestSchema.safeParse(rawPayload);
      if (!result.success) {
          socket.emit('error', 'Invalid song data format');
          return;
      }
      const { sessionId, songData, suggestedBy } = result.data;

      const identifier = suggestedBy || socket.handshake.address || socket.id;
      if (!(await checkRateLimit(`suggest:${identifier}`, 5, 60))) {
          socket.emit('error', 'You are suggesting too fast. Please wait.');
          return;
      }

      try {
        const session = await prisma.voteSession.findUnique({ where: { id: sessionId } });
        if (!session || !session.isActive) return;

        // Blacklist Check
        const blacklist = await prisma.blacklist.findMany({ where: { hostId: session.hostId } });
        const isBanned = blacklist.some(item => {
            if (item.type === 'SONG_ID') return item.value === songData.id;
            if (item.type === 'KEYWORD') {
                const text = `${songData.title} ${songData.artist}`.toLowerCase();
                return text.includes(item.value.toLowerCase());
            }
            return false;
        });

        if (isBanned) {
            socket.emit('error', 'This song is blocked by the host.');
            return;
        }

        let forcePending = false;

        // 1. DUPLICATE CHECK (Soft Fail)
        if (session.enableDuplicateCheck) {
            // Check if played in last 2 hours
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
            const recentlyPlayed = await prisma.queueItem.findFirst({
                where: {
                    voteSessionId: sessionId,
                    songId: songData.id,
                    updatedAt: { gt: twoHoursAgo },
                    status: 'PLAYED'
                }
            });
            if (recentlyPlayed) {
                // Soft Fail: Send to Host Approval
                forcePending = true;
                socket.emit('error', 'Played recently. Sent to host for approval.');
            }
        }

        // 2. REGION CHECK (If Enabled)
        if (session.enableRegionCheck) {
            try {
                // Perform a strict lookup for just this video
                const [details] = await searchYouTube(`https://youtube.com/watch?v=${songData.id}`, session.hostId, true);
                if (details && details.isPlayable === false) {
                    socket.emit('error', 'This song is region-locked or not embeddable.');
                    return;
                }
            } catch (err) {
                console.error("Region Check Failed (Allowing fallback)", err);
            }
        }

        await prisma.song.upsert({
          where: { id: songData.id },
          update: {},
          create: {
            id: songData.id,
            title: songData.title,
            artist: songData.artist,
            album: songData.album || 'Unknown',
            albumArtUrl: songData.albumArtUrl,
            durationMs: songData.durationMs || 0,
          }
        });

        const existing = await prisma.queueItem.findFirst({
          where: { 
              voteSessionId: sessionId, 
              songId: songData.id, 
              status: { in: ['LIVE', 'PLAYING', 'PENDING'] }
          }
        });
        
        if (existing) {
          socket.emit('error', 'Song already in queue');
          return;
        }

        // Determine Status based on verification OR soft-duplicate-check
        const status = (session.requireVerification || forcePending) ? 'PENDING' : 'LIVE';
        let validGuestId = null;
        if (suggestedBy) {
            const guest = await prisma.guestAccount.findUnique({ where: { id: suggestedBy } });
            if (guest && !guest.isBanned) validGuestId = suggestedBy;
        }
        
        await prisma.queueItem.create({
          data: {
            voteSessionId: sessionId,
            songId: songData.id,
            status: status,
            suggestedByGuestId: validGuestId,
            isRadio: false 
          }
        });

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
      } catch (e) { console.error("Suggest Error", e); }
    });

    // --- BATCH VOTING ---
    socket.on('batch-vote', async (rawPayload) => {
        const result = BatchVoteSchema.safeParse(rawPayload);
        if (!result.success) return;
        const { sessionId, queueItemIds, voterId } = result.data;

        const lockKey = `vote_lock:${sessionId}:${voterId}`;
        const isLocked = await redis.set(lockKey, 'locked', 'EX', 5, 'NX'); 
        
        if (!isLocked) {
            socket.emit('error', 'Processing previous vote. Please wait.');
            return;
        }

        try {
            const session = await prisma.voteSession.findUnique({ where: { id: sessionId } });
            if (!session) return;

            const historyKey = `session_votes:${sessionId}:${voterId}`;
            const cooldownKey = `session_cooldown:${sessionId}:${voterId}`;
            
            const ttl = await redis.ttl(cooldownKey);
            if (ttl > 0) {
                socket.emit('error', `Round active. Wait ${Math.ceil(ttl / 60)}m.`);
                return;
            }

            const currentVoteCount = await redis.scard(historyKey);
            if ((currentVoteCount + queueItemIds.length) > session.votesPerUser) {
                socket.emit('error', `Limit reached.`);
                return;
            }

            const alreadyVotedFor = await redis.smismember(historyKey, ...queueItemIds);
            const newVotes = queueItemIds.filter((_, index) => alreadyVotedFor[index] === 0);

            if (newVotes.length === 0) return;

            const updatePromises = newVotes.map(id => 
                prisma.queueItem.update({ where: { id }, data: { voteCount: { increment: 1 } } })
            );
            await prisma.$transaction(updatePromises);

            await redis.sadd(historyKey, ...newVotes);
            const expirySeconds = session.cycleDelay > 0 ? session.cycleDelay * 60 : 60 * 60 * 24;
            await redis.expire(historyKey, expirySeconds);
            if (session.cycleDelay > 0) {
                await redis.setex(cooldownKey, session.cycleDelay * 60, '1');
            }

            await broadcastState(io, sessionId);
            socket.emit('vote-success', { confirmedIds: newVotes, cooldownSeconds: session.cycleDelay * 60 });

        } catch (e) { 
            console.error("Batch Vote Error", e); 
        } finally {
            await redis.del(lockKey);
        }
    });

    // --- PLAYBACK TRANSITIONS ---
    socket.on('song-transition', async (rawPayload) => {
        const result = TransitionSchema.safeParse(rawPayload);
        if (!result.success) return;
        const { sessionId, prevId, nextId, voterId } = result.data;

        if (!voterId || !(await checkPermission(sessionId, voterId, 'controlPlayer'))) return;

        try {
            const ops = [];
            // Handle Previous: Archive & Auto-Add
            if (prevId) {
                ops.push(prisma.queueItem.update({ where: { id: prevId }, data: { status: 'PLAYED' } }));
                
                // TRIGGER AUTO-ADD & KARMA
                const prevItem = await prisma.queueItem.findUnique({ where: { id: prevId } });
                if (prevItem) {
                    handleAutoAdd(sessionId, prevItem.songId);
                    // GAMIFICATION: Award Karma
                    if (prevItem.suggestedByGuestId) {
                        await prisma.guestAccount.update({ 
                            where: { id: prevItem.suggestedByGuestId }, 
                            data: { karma: { increment: 10 } }
                        });
                    }
                }
            }
            
            let newPlayingId = nextId;

            if (nextId) {
                ops.push(prisma.queueItem.update({ where: { id: nextId }, data: { status: 'PLAYING' } }));
            }

            if (ops.length > 0) await prisma.$transaction(ops);

            // RADIO LOGIC
            if (!newPlayingId) {
                newPlayingId = await playRadioSong(sessionId);
            }

            if (newPlayingId) {
                const song = await prisma.queueItem.findUnique({ where: { id: newPlayingId }, select: { songId: true }});
                if(song) {
                    await setPlaybackState(sessionId, {
                        status: 'playing',
                        videoId: song.songId,
                        startTime: Date.now(),
                        timestamp: Date.now()
                    });
                }
            } else {
                await redis.del(`session_playback:${sessionId}`);
            }

            await broadcastState(io, sessionId);
        } catch (e) { console.error("Transition Error", e); }
    });

    socket.on('song-started', async (rawPayload) => {
        const result = ControlSchema.safeParse(rawPayload);
        if (!result.success) return;
        const { sessionId, queueItemId, voterId } = result.data;
        if (!queueItemId) return;

        if (!voterId || !(await checkPermission(sessionId, voterId, 'controlPlayer'))) return;

        try {
            const currentlyPlaying = await prisma.queueItem.findMany({ where: { voteSessionId: sessionId, status: 'PLAYING' } });
            
            // Archive old songs
            for (const item of currentlyPlaying) {
                handleAutoAdd(sessionId, item.songId);
            }
            await prisma.queueItem.updateMany({ where: { voteSessionId: sessionId, status: 'PLAYING' }, data: { status: 'PLAYED' } });
            
            await prisma.queueItem.update({ where: { id: queueItemId }, data: { status: 'PLAYING' } });
            
            const song = await prisma.queueItem.findUnique({ where: { id: queueItemId }, select: { songId: true }});
            if (song) {
                await setPlaybackState(sessionId, {
                    status: 'playing',
                    videoId: song.songId,
                    startTime: Date.now(),
                    timestamp: Date.now()
                });
            }
            await broadcastState(io, sessionId);
        } catch (e) { console.error("Start Error", e); }
    });

    socket.on('song-ended', async (rawPayload) => {
        const result = ControlSchema.safeParse(rawPayload);
        if (!result.success) return;
        const { sessionId, queueItemId, voterId } = result.data;
        if (!queueItemId) return;

        if (!voterId || !(await checkPermission(sessionId, voterId, 'controlPlayer'))) return;

        try {
            await prisma.queueItem.update({ where: { id: queueItemId }, data: { status: 'PLAYED' } });
            
            const item = await prisma.queueItem.findUnique({ where: { id: queueItemId } });
            if (item) {
                await handleAutoAdd(sessionId, item.songId);
                if (item.suggestedByGuestId) await prisma.guestAccount.update({ where: { id: item.suggestedByGuestId }, data: { karma: { increment: 10 } }});
            }

            await redis.del(`session_playback:${sessionId}`);
            await broadcastState(io, sessionId);
        } catch (e) { console.error("End Error", e); }
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
        } catch (e) { console.error("Back Error", e); }
    });

    socket.on('force-play', async (rawPayload) => {
        const result = ForcePlaySchema.safeParse(rawPayload);
        if (!result.success) return;
        const { sessionId, songData, voterId } = result.data;

        if (!voterId || !(await checkPermission(sessionId, voterId, 'forcePlay'))) return;

        try {
            await prisma.song.upsert({
                where: { id: songData.id },
                update: {},
                create: { id: songData.id, title: songData.title, artist: songData.artist, album: 'Force Played', albumArtUrl: songData.albumArtUrl, durationMs: 0 }
            });
            await prisma.queueItem.updateMany({ where: { voteSessionId: sessionId, status: 'PLAYING' }, data: { status: 'PLAYED' } });
            
            const existing = await prisma.queueItem.findFirst({ where: { voteSessionId: sessionId, status: 'LIVE', songId: songData.id } });
            if (existing) {
                await prisma.queueItem.update({ where: { id: existing.id }, data: { status: 'PLAYING', voteCount: 999 } });
            } else {
                await prisma.queueItem.create({ data: { voteSessionId: sessionId, songId: songData.id, status: 'PLAYING', voteCount: 999, isRadio: false } });
            }
            
            await setPlaybackState(sessionId, { status: 'playing', videoId: songData.id, startTime: Date.now(), timestamp: Date.now() });
            await broadcastState(io, sessionId);
        } catch (e) { console.error("Force Play Error", e); }
    });

    socket.on('remove-song', async (rawPayload) => {
        const result = ControlSchema.safeParse(rawPayload);
        if (!result.success) return;
        const { sessionId, queueItemId, voterId } = result.data;
        if (!queueItemId) return;

        if (!voterId || !(await checkPermission(sessionId, voterId, 'manageQueue'))) return;
        try {
            await prisma.queueItem.update({ where: { id: queueItemId }, data: { status: 'REJECTED' } });
            await broadcastState(io, sessionId);
        } catch (e) {}
    });

    socket.on('ban-suggester', async (rawPayload) => {
        const result = ControlSchema.safeParse(rawPayload);
        if (!result.success) return;
        const { sessionId, queueItemId, voterId } = result.data;
        if (!queueItemId) return;

        if (!voterId || !(await checkPermission(sessionId, voterId, 'manageUsers'))) return;
        try {
            const item = await prisma.queueItem.findUnique({ where: { id: queueItemId }, include: { guest: true } });
            if (item && item.suggestedByGuestId) {
                await prisma.guestAccount.update({ where: { id: item.suggestedByGuestId }, data: { isBanned: true } });
                await prisma.queueItem.update({ where: { id: queueItemId }, data: { status: 'REJECTED' } });
                await broadcastState(io, sessionId);
            }
        } catch (e) {}
    });

    socket.on('admin-reset-timer', async (rawPayload) => {
        const result = z.object({ sessionId: SessionIdSchema, targetUserId: z.string().optional(), voterId: z.string().uuid() }).safeParse(rawPayload);
        if (!result.success) return;
        const { sessionId, targetUserId, voterId } = result.data;

        if (!voterId || !(await checkPermission(sessionId, voterId, 'manageUsers'))) return;
        try {
            if (targetUserId) {
                await redis.del(`session_votes:${sessionId}:${targetUserId}`);
                await redis.del(`session_cooldown:${sessionId}:${targetUserId}`);
                io.to(sessionId).emit('timer-reset', { targetUserId });
            } else {
                const guests = await prisma.guestAccount.findMany({ where: { voteSessionId: sessionId } });
                const session = await prisma.voteSession.findUnique({ where: { id: sessionId }});
                const allIds = [session?.hostId, ...guests.map(g => g.id)].filter(Boolean) as string[];
                const keysToDelete = [];
                for (const id of allIds) {
                    keysToDelete.push(`session_votes:${sessionId}:${id}`);
                    keysToDelete.push(`session_cooldown:${sessionId}:${id}`);
                }
                if (keysToDelete.length > 0) await redis.del(...keysToDelete);
                io.to(sessionId).emit('timer-reset', { targetUserId: null });
            }
        } catch (e) { console.error("Admin Reset Error", e); }
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
        } catch (e) { console.error("Clear Session Error", e); }
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
        } catch(e) {}
    });

    socket.on('reject-song', async (rawPayload) => {
        const result = ModSchema.safeParse(rawPayload);
        if (!result.success) return;
        const { itemId, sessionId } = result.data;

        try {
            await prisma.queueItem.update({ where: { id: itemId }, data: { status: 'REJECTED' } });
            const pending = await prisma.queueItem.findMany({ where: { voteSessionId: sessionId, status: 'PENDING' }, include: { song: true }, orderBy: { createdAt: 'asc' } });
            io.to(`host-${sessionId}`).emit('pending-update', pending);
        } catch(e) {}
    });

    socket.on('disconnect', () => {});
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});