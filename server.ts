// ========================================================================
// FILE: server.ts
// ========================================================================

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { redis } from './lib/redis';
import { checkPermission } from './lib/permissions';
import { checkRateLimit } from './lib/ratelimit';

const prisma = new PrismaClient();

// Handle Redis connection errors gracefully
redis.on('error', (err) => {
    if ((err as any).code !== 'ECONNREFUSED') {
        console.error('Redis Client Error', err);
    }
});

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

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

/**
 * Checks if queue is empty. If so, picks a random song from history
 * and inserts it DIRECTLY as 'PLAYING'. 
 * This ensures it plays but DOES NOT appear in the 'LIVE' voting list.
 */
const playRadioSong = async (sessionId: string) => {
    // 1. Check if Queue has items
    const queueCount = await prisma.queueItem.count({
        where: { voteSessionId: sessionId, status: 'LIVE' }
    });

    if (queueCount > 0) return null; // Queue has songs, no need for radio

    // 2. Get History
    const candidates = await prisma.queueItem.findMany({
        where: { voteSessionId: sessionId, status: 'PLAYED' },
        select: { songId: true },
        distinct: ['songId']
    });

    if (candidates.length === 0) return null;

    // 3. Filter out the very last played song to avoid back-to-back repeats
    const lastPlayed = await prisma.queueItem.findFirst({
        where: { voteSessionId: sessionId, status: 'PLAYED' },
        orderBy: { updatedAt: 'desc' }
    });

    let pool = candidates;
    if (pool.length > 1 && lastPlayed) {
        pool = pool.filter(c => c.songId !== lastPlayed.songId);
    }

    // 4. Pick Random
    const randomIndex = Math.floor(Math.random() * pool.length);
    const songId = pool[randomIndex].songId;

    console.log(`[RADIO] Queue empty. Playing history track: ${songId}`);

    // 5. Create as PLAYING (Bypasses Voting Queue)
    const radioItem = await prisma.queueItem.create({
        data: {
            voteSessionId: sessionId,
            songId: songId,
            status: 'PLAYING', // Crucial: This keeps it out of the LIVE list
            voteCount: 0, 
            suggestedByGuestId: null 
        }
    });

    return radioItem.id;
};

const broadcastState = async (io: Server, sessionId: string) => {
    // 1. Get Live Queue
    const queue = await prisma.queueItem.findMany({
        where: { voteSessionId: sessionId, status: 'LIVE' },
        include: { song: true },
        orderBy: { voteCount: 'desc' }
    });

    // 2. Get Currently Playing
    const current = await prisma.queueItem.findFirst({
        where: { voteSessionId: sessionId, status: 'PLAYING' },
        include: { song: true }
    });

    // 3. Get Sync State
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

  io.on('connection', (socket) => {
    
    // --- JOIN LOGIC ---
    socket.on('join-room', async (roomId) => {
      socket.join(roomId);
      try { await broadcastState(io, roomId); } catch (e) { console.error(e); }
    });

    socket.on('join-host-room', async (roomId) => {
      socket.join(`host-${roomId}`);
      try {
        const pending = await prisma.queueItem.findMany({
            where: { voteSessionId: roomId, status: 'PENDING' },
            include: { song: true },
            orderBy: { createdAt: 'asc' }
        });
        socket.emit('pending-update', pending);
      } catch (e) { console.error(e); }
    });

    // --- PLAYER SYNC ---
    socket.on('player-update', async ({ sessionId, state, voterId }) => {
        if (!(await checkPermission(sessionId, voterId, 'controlPlayer'))) return;
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

    // --- SONG SUGGESTION ---
    socket.on('suggest-song', async ({ sessionId, songData, suggestedBy }) => {
      if (suggestedBy && !(await checkRateLimit(`suggest:${suggestedBy}`, 5, 60))) {
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

        const status = session.requireVerification ? 'PENDING' : 'LIVE';
        let validGuestId = null;
        if (suggestedBy) {
            const guest = await prisma.guestAccount.findUnique({ where: { id: suggestedBy } });
            if (guest) validGuestId = suggestedBy;
        }
        
        await prisma.queueItem.create({
          data: {
            voteSessionId: sessionId,
            songId: songData.id,
            status: status,
            suggestedByGuestId: validGuestId 
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

    // --- BATCH VOTING (Limits & Cooldowns) ---
    socket.on('batch-vote', async ({ sessionId, queueItemIds, voterId }) => {
        try {
            if (!voterId || !Array.isArray(queueItemIds) || queueItemIds.length === 0) return;

            const session = await prisma.voteSession.findUnique({ where: { id: sessionId } });
            if (!session) return;

            const historyKey = `session_votes:${sessionId}:${voterId}`;
            const cooldownKey = `session_cooldown:${sessionId}:${voterId}`;
            
            // 1. Check Cooldown
            const ttl = await redis.ttl(cooldownKey);
            if (ttl > 0) {
                socket.emit('error', `Round active. Wait ${Math.ceil(ttl / 60)}m.`);
                return;
            }

            // 2. Check Limits
            const currentVoteCount = await redis.scard(historyKey);
            if ((currentVoteCount + queueItemIds.length) > session.votesPerUser) {
                socket.emit('error', `Limit reached.`);
                return;
            }

            // 3. Filter Duplicates
            const alreadyVotedFor = await redis.smismember(historyKey, ...queueItemIds);
            const newVotes = queueItemIds.filter((_, index) => alreadyVotedFor[index] === 0);

            if (newVotes.length === 0) return;

            // 4. DB Update
            const updatePromises = newVotes.map(id => 
                prisma.queueItem.update({ where: { id }, data: { voteCount: { increment: 1 } } })
            );
            await prisma.$transaction(updatePromises);

            // 5. Redis Update
            await redis.sadd(historyKey, ...newVotes);
            const expirySeconds = session.cycleDelay > 0 ? session.cycleDelay * 60 : 60 * 60 * 24;
            await redis.expire(historyKey, expirySeconds);
            if (session.cycleDelay > 0) {
                await redis.setex(cooldownKey, session.cycleDelay * 60, '1');
            }

            await broadcastState(io, sessionId);
            socket.emit('vote-success', { confirmedIds: newVotes, cooldownSeconds: session.cycleDelay * 60 });

        } catch (e) { console.error("Batch Vote Error", e); }
    });

    // --- PLAYBACK TRANSITIONS (Atomic Swap) ---
    
    socket.on('song-transition', async ({ sessionId, prevId, nextId, voterId }) => {
        if (!(await checkPermission(sessionId, voterId, 'controlPlayer'))) return;

        try {
            const ops = [];
            // 1. Archive Previous
            if (prevId) {
                ops.push(prisma.queueItem.update({ where: { id: prevId }, data: { status: 'PLAYED' } }));
            }
            
            // 2. Determine Next Song ID
            let newPlayingId = nextId;

            // 3. Mark Next as PLAYING (if exists in Queue)
            if (nextId) {
                ops.push(prisma.queueItem.update({ where: { id: nextId }, data: { status: 'PLAYING' } }));
            }

            if (ops.length > 0) await prisma.$transaction(ops);

            // 4. RADIO LOGIC: If no next song provided (Queue Empty), trigger Radio
            if (!newPlayingId) {
                newPlayingId = await playRadioSong(sessionId);
            }

            // 5. Sync State Update
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
                // If Radio failed (empty history) and no queue -> Stop
                await redis.del(`session_playback:${sessionId}`);
            }

            await broadcastState(io, sessionId);
        } catch (e) { console.error("Transition Error", e); }
    });

    // --- PLAYBACK HELPERS ---

    socket.on('song-started', async ({ sessionId, queueItemId, voterId }) => {
        if (!(await checkPermission(sessionId, voterId, 'controlPlayer'))) return;
        try {
            // Cleanup any stuck PLAYING items
            await prisma.queueItem.updateMany({ where: { voteSessionId: sessionId, status: 'PLAYING' }, data: { status: 'PLAYED' } });
            
            // Promote new item
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

    socket.on('song-ended', async ({ sessionId, queueItemId, voterId }) => {
        if (voterId && !(await checkPermission(sessionId, voterId, 'controlPlayer'))) return;
        try {
            await prisma.queueItem.update({ where: { id: queueItemId }, data: { status: 'PLAYED' } });
            await redis.del(`session_playback:${sessionId}`);
            await broadcastState(io, sessionId);
        } catch (e) { console.error("End Error", e); }
    });

    socket.on('song-back', async ({ sessionId, voterId }) => {
        if (!(await checkPermission(sessionId, voterId, 'controlPlayer'))) return;
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

    // --- ADMIN / MANAGEMENT ---

    socket.on('force-play', async ({ sessionId, songData, voterId }) => {
        if (!(await checkPermission(sessionId, voterId, 'forcePlay'))) return;
        try {
            // Save Metadata
            await prisma.song.upsert({
                where: { id: songData.id },
                update: {},
                create: { id: songData.id, title: songData.title, artist: songData.artist, album: 'Force Played', albumArtUrl: songData.albumArtUrl, durationMs: 0 }
            });
            // Archive Current
            await prisma.queueItem.updateMany({ where: { voteSessionId: sessionId, status: 'PLAYING' }, data: { status: 'PLAYED' } });
            
            // Check Existing in Queue
            const existing = await prisma.queueItem.findFirst({ where: { voteSessionId: sessionId, status: 'LIVE', songId: songData.id } });
            if (existing) {
                await prisma.queueItem.update({ where: { id: existing.id }, data: { status: 'PLAYING', voteCount: 999 } });
            } else {
                await prisma.queueItem.create({ data: { voteSessionId: sessionId, songId: songData.id, status: 'PLAYING', voteCount: 999 } });
            }
            
            await setPlaybackState(sessionId, { status: 'playing', videoId: songData.id, startTime: Date.now(), timestamp: Date.now() });
            await broadcastState(io, sessionId);
        } catch (e) { console.error("Force Play Error", e); }
    });

    socket.on('remove-song', async ({ sessionId, queueItemId, voterId }) => {
        if (!(await checkPermission(sessionId, voterId, 'manageQueue'))) return;
        try {
            await prisma.queueItem.update({ where: { id: queueItemId }, data: { status: 'REJECTED' } });
            await broadcastState(io, sessionId);
        } catch (e) {}
    });

    socket.on('ban-suggester', async ({ sessionId, queueItemId, voterId }) => {
        if (!(await checkPermission(sessionId, voterId, 'manageUsers'))) return;
        try {
            const item = await prisma.queueItem.findUnique({ where: { id: queueItemId }, include: { guest: true } });
            if (item && item.suggestedByGuestId) {
                await prisma.guestAccount.update({ where: { id: item.suggestedByGuestId }, data: { isBanned: true } });
                await prisma.queueItem.update({ where: { id: queueItemId }, data: { status: 'REJECTED' } });
                await broadcastState(io, sessionId);
            }
        } catch (e) {}
    });

    socket.on('admin-reset-timer', async ({ sessionId, targetUserId, voterId }) => {
        if (!(await checkPermission(sessionId, voterId, 'manageUsers'))) return;
        try {
            if (targetUserId) {
                await redis.del(`session_votes:${sessionId}:${targetUserId}`);
                await redis.del(`session_cooldown:${sessionId}:${targetUserId}`);
                io.to(sessionId).emit('timer-reset', { targetUserId });
            } else {
                // Reset All
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

    socket.on('clear-session', async ({ sessionId, voterId }) => {
        if (!(await checkPermission(sessionId, voterId, 'manageQueue'))) return;
        try {
            await prisma.queueItem.deleteMany({ where: { voteSessionId: sessionId } });
            await redis.del(`session_playback:${sessionId}`);
            await broadcastState(io, sessionId);
            io.to(sessionId).emit('session-cleared');
        } catch (e) { console.error("Clear Session Error", e); }
    });

    // --- MODERATION ---
    socket.on('approve-song', async ({ itemId, sessionId }) => {
        try {
            await prisma.queueItem.update({ where: { id: itemId }, data: { status: 'LIVE' } });
            await broadcastState(io, sessionId);
            const pending = await prisma.queueItem.findMany({ where: { voteSessionId: sessionId, status: 'PENDING' }, include: { song: true }, orderBy: { createdAt: 'asc' } });
            io.to(`host-${sessionId}`).emit('pending-update', pending);
        } catch(e) {}
    });

    socket.on('reject-song', async ({ itemId, sessionId }) => {
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