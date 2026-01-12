'use server';

import { prisma } from '@/lib/db';
import { getCurrentUser, loginUser } from '@/lib/auth';
import { encrypt } from '@/lib/crypto';
import { redis } from '@/lib/redis';
import { revalidatePath } from 'next/cache';
import { generateVoteId } from '@/lib/utils';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Permissions } from '@/lib/permissions';
import bcrypt from 'bcryptjs';
import { searchYouTube } from '@/lib/youtube';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { logger } from '@/lib/logger';

// --- TICKET SYSTEM ACTIONS ---

export async function createSupportTicket(formData: FormData) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    const subject = formData.get('subject') as string;
    const content = formData.get('content') as string;
    const priority = formData.get('priority') as 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

    if (!subject || !content) throw new Error("Missing fields");

    const ticket = await prisma.supportTicket.create({
        data: {
            hostId: user.userId,
            subject,
            priority: priority || 'NORMAL',
            hasUnreadForAdmin: true,
            hasUnreadForHost: false,
            messages: {
                create: {
                    senderId: user.userId,
                    content,
                    isAdmin: false
                }
            }
        }
    });

    logger.info({ userId: user.userId, ticketId: ticket.id, subject }, 'Support Ticket Created');

    const payload = {
        type: 'NEW_TICKET',
        data: { id: ticket.id, subject: ticket.subject, host: user.username },
        notifyAdmin: true 
    };

    await redis.publish('ticket_updates', JSON.stringify(payload));
    revalidatePath(`/${user.username}/support`);
}

export async function replyToTicket(ticketId: string, content: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error("Ticket not found");

    const isAdmin = user.userId === process.env.SUPER_ADMIN_ID;

    if (!isAdmin && ticket.hostId !== user.userId) {
        logger.warn({ userId: user.userId, ticketId }, 'Unauthorized Ticket Access Attempt');
        throw new Error("Unauthorized access to ticket");
    }

    const message = await prisma.ticketMessage.create({
        data: {
            ticketId,
            senderId: user.userId,
            content,
            isAdmin
        }
    });

    // Update flags
    await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { 
            status: isAdmin ? 'IN_PROGRESS' : 'OPEN',
            updatedAt: new Date(),
            hasUnreadForAdmin: !isAdmin,
            hasUnreadForHost: isAdmin
        }
    });

    const payload = {
        type: 'TICKET_REPLY',
        ticketId: ticket.id,
        message, 
        notifyAdmin: !isAdmin, 
        notifyUser: isAdmin,   
        targetUserId: isAdmin ? ticket.hostId : null 
    };

    await redis.publish('ticket_updates', JSON.stringify(payload));
    logger.info({ userId: user.userId, ticketId, isAdmin }, 'Ticket Reply Sent');

    if (isAdmin) revalidatePath('/admin/support');
    else revalidatePath(`/${user.username}/support`);
}

export async function markTicketRead(ticketId: string) {
    const user = await getCurrentUser();
    if (!user) return;

    const isAdmin = user.userId === process.env.SUPER_ADMIN_ID;

    await prisma.supportTicket.update({
        where: { id: ticketId },
        data: {
            hasUnreadForAdmin: isAdmin ? false : undefined,
            hasUnreadForHost: !isAdmin ? false : undefined
        }
    });
}

export async function getUnreadTicketCount() {
    const user = await getCurrentUser();
    if (!user) return 0;

    const isAdmin = user.userId === process.env.SUPER_ADMIN_ID;

    if (isAdmin) {
        return await prisma.supportTicket.count({
            where: { hasUnreadForAdmin: true }
        });
    } else {
        return await prisma.supportTicket.count({
            where: { 
                hostId: user.userId,
                hasUnreadForHost: true
            }
        });
    }
}

export async function updateTicketStatus(ticketId: string, status: 'OPEN' | 'RESOLVED' | 'CLOSED') {
    const user = await getCurrentUser();
    if (!user || user.userId !== process.env.SUPER_ADMIN_ID) throw new Error("Unauthorized");

    const ticket = await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { 
            status,
            hasUnreadForHost: true 
        }
    });

    const payload = {
        type: 'TICKET_STATUS',
        ticketId: ticket.id,
        status: status,
        notifyUser: true,
        targetUserId: ticket.hostId
    };

    await redis.publish('ticket_updates', JSON.stringify(payload));
    logger.info({ userId: user.userId, ticketId, status }, 'Ticket Status Updated');
    revalidatePath('/admin/support');
}

export async function getTicketsForHost() {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    return await prisma.supportTicket.findMany({
        where: { hostId: user.userId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
        orderBy: { updatedAt: 'desc' }
    });
}

export async function getAllTicketsAdmin() {
    const user = await getCurrentUser();
    if (!user || user.userId !== process.env.SUPER_ADMIN_ID) throw new Error("Unauthorized");

    return await prisma.supportTicket.findMany({
        include: { 
            host: { select: { username: true, avatarUrl: true } },
            messages: { orderBy: { createdAt: 'asc' } } 
        },
        orderBy: { updatedAt: 'desc' }
    });
}

export async function submitFeedback(formData: FormData) {
    const content = formData.get('content') as string;
    const type = formData.get('type') as 'BUG' | 'SUGGESTION' | 'OTHER';
    const hostUser = await getCurrentUser();
    const guestId = cookies().get('guest_id')?.value;
    const userId = hostUser?.userId || guestId || null;
    if (!content || !type) throw new Error("Missing fields");
    
    const feedback = await prisma.systemFeedback.create({ data: { content, type, userId } });
    await redis.publish('admin_channel', JSON.stringify({ type: 'NEW_FEEDBACK', data: feedback }));
    logger.info({ userId, type }, 'Feedback Submitted');
}

export async function getSystemFeedback() {
    const user = await getCurrentUser();
    if (!user || user.userId !== process.env.SUPER_ADMIN_ID) throw new Error("Unauthorized");
    return await prisma.systemFeedback.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
}

export async function updateFeedbackStatus(id: string, status: 'OPEN' | 'RESOLVED' | 'ARCHIVED') {
    const user = await getCurrentUser();
    if (!user || user.userId !== process.env.SUPER_ADMIN_ID) throw new Error("Unauthorized");
    await prisma.systemFeedback.update({ where: { id }, data: { status } });
    revalidatePath('/admin/feedback');
}

export async function deleteFeedback(id: string) {
    const user = await getCurrentUser();
    if (!user || user.userId !== process.env.SUPER_ADMIN_ID) throw new Error("Unauthorized");
    await prisma.systemFeedback.delete({ where: { id } });
    revalidatePath('/admin/feedback');
}

export async function getDetailedAnalytics() {
    const user = await getCurrentUser();
    if (!user || user.userId !== process.env.SUPER_ADMIN_ID) throw new Error("Unauthorized");
    const [topSongs, hourlyStatsRaw] = await Promise.all([
        prisma.song.findMany({ orderBy: { playCount: 'desc' }, take: 10, select: { id: true, title: true, artist: true, albumArtUrl: true, playCount: true } }),
        prisma.queueItem.findMany({ where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }, select: { createdAt: true } })
    ]);
    const hours = new Array(24).fill(0);
    hourlyStatsRaw.forEach(item => { const hour = item.createdAt.getHours(); hours[hour]++; });
    const hourlyChart = hours.map((count, hour) => ({ hour: `${hour}:00`, count }));
    return { topSongs, hourlyChart };
}

export async function getSystemHealth() {
    const user = await getCurrentUser();
    if (!user || user.userId !== process.env.SUPER_ADMIN_ID) throw new Error("Unauthorized");
    const start = Date.now();
    try { await prisma.$queryRaw`SELECT 1`; } catch(e) {}
    const dbLatency = Date.now() - start;
    const info = await redis.info('memory');
    const memoryMatch = info.match(/used_memory_human:(.*)/);
    const memory = memoryMatch ? memoryMatch[1].trim() : 'Unknown';
    const connectionsStr = await redis.get('system:active_connections');
    const connections = parseInt(connectionsStr || '0');
    return { memory, connections: connections < 0 ? 0 : connections, dbLatency, timestamp: Date.now() };
}

export async function completeTutorial() {
    const user = await getCurrentUser();
    if (!user) return;
    await prisma.host.update({ where: { id: user.userId }, data: { tutorialCompleted: true } });
    revalidatePath(`/${user.username}`);
}

export async function resetTutorial() {
    const user = await getCurrentUser();
    if (!user) return;
    await prisma.host.update({ where: { id: user.userId }, data: { tutorialCompleted: false } });
    revalidatePath(`/${user.username}`);
}

export async function uploadHostAvatar(formData: FormData) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');
    const file = formData.get('avatarFile') as File;
    const fallbackUrl = formData.get('avatarUrl') as string;
    
    try {
        if (file && file.size > 0) {
            if (!file.type.startsWith('image/')) throw new Error('File must be an image');
            if (file.size > 5 * 1024 * 1024) throw new Error('File too large (Max 5MB)');
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);
            const ext = file.name.split('.').pop()?.substring(0, 4) || 'png';
            const filename = `${user.userId}-${Date.now()}.${ext}`;
            const uploadDir = join(process.cwd(), 'public', 'uploads');
            await mkdir(uploadDir, { recursive: true });
            await writeFile(join(uploadDir, filename), buffer);
            const publicPath = `/uploads/${filename}`;
            await prisma.host.update({ where: { id: user.userId }, data: { avatarUrl: publicPath } });
            logger.info({ userId: user.userId, filename }, 'Avatar Uploaded');
        } else if (fallbackUrl) {
            await prisma.host.update({ where: { id: user.userId }, data: { avatarUrl: fallbackUrl } });
        }
    } catch(e: any) {
        logger.error({ err: e, userId: user.userId }, 'Avatar Upload Failed');
        throw e;
    }
    revalidatePath(`/${user.username}/profile`);
    revalidatePath(`/${user.username}`);
}

export async function updateHostProfile(formData: FormData) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');
    const avatarUrl = formData.get('avatarUrl') as string;
    await prisma.host.update({ where: { id: user.userId }, data: { avatarUrl } });
    revalidatePath(`/${user.username}/profile`);
    revalidatePath(`/${user.username}`);
}

export async function createDemoSession() {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const username = `demo_host_${randomSuffix}`;
    const password = `demo_${randomSuffix}`; 
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.host.create({
        data: {
            username,
            passwordHash: hashedPassword,
            settings: { create: { bgColor: "#ffffff", fgColor: "#0f172a", accentColor: "#6366f1", darkMode: false } },
            tutorialCompleted: true
        }
    });
    await loginUser(user.id, user.username);
    const voteId = generateVoteId();
    await prisma.voteSession.create({ data: { id: voteId, hostId: user.id, title: "Demo Party", isActive: true, votesPerUser: 10, requireVerification: false } });
    const guestsData = [];
    for(let i=0; i<3; i++) {
        guestsData.push({ voteSessionId: voteId, username: `Guest_${i+1}`, password: Math.floor(1000 + Math.random() * 9000).toString() });
    }
    await prisma.guestAccount.createMany({ data: guestsData });
    logger.info({ userId: user.id }, 'Demo Session Created');
    redirect(`/${user.username}/${voteId}`);
}

export async function updateGlobalSettings(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  const bgColor = formData.get('bgColor') as string;
  const fgColor = formData.get('fgColor') as string;
  const accentColor = formData.get('accentColor') as string;
  const darkBgColor = formData.get('darkBgColor') as string;
  const darkFgColor = formData.get('darkFgColor') as string;
  const darkAccentColor = formData.get('darkAccentColor') as string;
  const darkMode = formData.get('darkMode') === 'on';
  await prisma.globalSettings.upsert({
    where: { hostId: user.userId },
    update: { bgColor, fgColor, accentColor, darkBgColor, darkFgColor, darkAccentColor, darkMode },
    create: { hostId: user.userId, bgColor, fgColor, accentColor, darkBgColor, darkFgColor, darkAccentColor, darkMode }
  });
  revalidatePath(`/${user.username}`);
  revalidatePath(`/${user.username}/settings`);
}

export async function toggleDarkMode(currentHostname: string) {
  const user = await getCurrentUser();
  if (!user) return;
  const settings = await prisma.globalSettings.findUnique({ where: { hostId: user.userId } });
  if (settings) {
    await prisma.globalSettings.update({ where: { hostId: user.userId }, data: { darkMode: !settings.darkMode } });
    revalidatePath(`/${currentHostname}`);
  }
}

export async function saveYoutubeCredentials(formData: FormData) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');
    const apiKey = formData.get('youtubeApiKey') as string;
    if (!apiKey) throw new Error("API Key required");
    await prisma.host.update({ where: { id: user.userId }, data: { youtubeApiKey: encrypt(apiKey) } });
    logger.info({ userId: user.userId }, 'YouTube Key Updated');
    revalidatePath(`/${user.username}/settings`);
}

export async function createCollection(formData: FormData) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');
    const title = formData.get('title') as string;
    const sessionId = formData.get('sessionId') as string;
    if (!title) return;
    await prisma.songCollection.create({ data: { hostId: user.userId, title: title } });
    if (sessionId) { revalidatePath(`/${user.username}/${sessionId}/settings`); } else { revalidatePath(`/${user.username}`); }
}

export async function bulkImportSongs(formData: FormData) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');
    const collectionId = formData.get('collectionId') as string;
    const rawText = formData.get('rawText') as string;
    const sessionId = formData.get('sessionId') as string;
    if (!collectionId || !rawText) return;
    const lines = rawText.split(/\r?\n/).filter(line => line.trim().length > 0);
    const limit = 50; 
    const tracksToProcess = lines.slice(0, limit);
    
    logger.info({ userId: user.userId, collectionId, count: tracksToProcess.length }, 'Bulk Import Started');

    for (const line of tracksToProcess) {
        try {
            const query = line.trim();
            const results = await searchYouTube(query, user.userId, false);
            if (results.length > 0) {
                const track = results[0]; 
                await prisma.song.upsert({ where: { id: track.id }, update: {}, create: { id: track.id, title: track.title, artist: track.artist, album: 'Imported', albumArtUrl: track.albumArtUrl, durationMs: track.durationMs || 0 } });
                await prisma.collectionItem.create({ data: { collectionId, songId: track.id } }).catch(() => {}); 
            }
        } catch (e) { 
            logger.warn({ userId: user.userId, line, err: e }, 'Bulk Import Item Failed');
        }
    }
    if (sessionId) { revalidatePath(`/${user.username}/${sessionId}/settings`); }
}

export async function createSession(formData: FormData) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');
    const title = formData.get('title') as string || 'New Session';
    const voteId = generateVoteId();
    await prisma.voteSession.create({ data: { id: voteId, hostId: user.userId, title: title, isActive: true, votesPerUser: 5, requireVerification: false } });
    logger.info({ userId: user.userId, sessionId: voteId }, 'Session Created');
    revalidatePath(`/${user.username}`);
    redirect(`/${user.username}/${voteId}`);
}

export async function deleteSession(formData: FormData) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');
    const sessionId = formData.get('sessionId') as string;
    const session = await prisma.voteSession.findUnique({ where: { id: sessionId } });
    if (session && session.hostId === user.userId) {
        await prisma.queueItem.deleteMany({ where: { voteSessionId: sessionId } });
        await prisma.guestAccount.deleteMany({ where: { voteSessionId: sessionId } });
        await prisma.sessionSettings.deleteMany({ where: { voteSessionId: sessionId } });
        await prisma.voteSession.delete({ where: { id: sessionId } });
        logger.info({ userId: user.userId, sessionId }, 'Session Deleted');
    }
    revalidatePath(`/${user.username}`);
}

export async function updateSessionRules(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  const sessionId = formData.get('sessionId') as string;
  const requireVerification = formData.get('requireVerification') === 'on';
  const votesPerUser = parseInt(formData.get('votesPerUser') as string) || 5;
  const cycleDelay = parseInt(formData.get('cycleDelay') as string) || 0;
  const startTimeStr = formData.get('startTime') as string;
  const endTimeStr = formData.get('endTime') as string;
  const backupPlaylistId = formData.get('backupPlaylistId') as string;
  const backupCollectionId = formData.get('backupCollectionId') as string;
  const autoAddToCollectionId = formData.get('autoAddToCollectionId') as string;
  const enableReactions = formData.get('enableReactions') === 'on';
  const enableDuplicateCheck = formData.get('enableDuplicateCheck') === 'on';
  const enableRegionCheck = formData.get('enableRegionCheck') === 'on';
  let cleanedPlaylistId = null;
  if (backupPlaylistId) {
      const match = backupPlaylistId.match(/[?&]list=([^#\&\?]+)/);
      cleanedPlaylistId = match ? match[1] : backupPlaylistId;
  }
  const startTime = startTimeStr ? new Date(startTimeStr) : null;
  const endTime = endTimeStr ? new Date(endTimeStr) : null;
  await prisma.voteSession.update({
    where: { id: sessionId, hostId: user.userId },
    data: { requireVerification, votesPerUser, cycleDelay, startTime, endTime, backupPlaylistId: cleanedPlaylistId, backupCollectionId: backupCollectionId || null, autoAddToCollectionId: autoAddToCollectionId || null, enableReactions, enableDuplicateCheck, enableRegionCheck }
  });
  if (cleanedPlaylistId) { await redis.del(`radio_playlist:${cleanedPlaylistId}`); }
  logger.info({ userId: user.userId, sessionId }, 'Session Rules Updated');
  revalidatePath(`/${user.username}/${sessionId}/settings`);
}

export async function generateGuests(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  const sessionId = formData.get('sessionId') as string;
  const count = parseInt(formData.get('count') as string);
  const nouns = ['Fox', 'Bear', 'Wolf', 'Owl', 'Cat', 'Dog', 'Lion'];
  const adjs = ['Red', 'Blue', 'Fast', 'Cool', 'Neon', 'Hot', 'Ice'];
  const guestsData = [];
  for(let i=0; i<count; i++) {
     const randomName = `${adjs[Math.floor(Math.random()*adjs.length)]}${nouns[Math.floor(Math.random()*nouns.length)]}${Math.floor(Math.random()*99)}`;
     const randomPass = Math.floor(1000 + Math.random() * 9000).toString();
     guestsData.push({ voteSessionId: sessionId, username: randomName, password: randomPass });
  }
  await prisma.guestAccount.createMany({ data: guestsData });
  logger.info({ userId: user.userId, sessionId, count }, 'Guest Accounts Generated');
  revalidatePath(`/${user.username}/${sessionId}/settings`);
}

export async function banGuest(formData: FormData) {
    const user = await getCurrentUser();
    if (!user) return;
    const guestId = formData.get('guestId') as string;
    const guest = await prisma.guestAccount.findUnique({ where: { id: guestId }, include: { voteSession: true } });
    if (guest && guest.voteSession.hostId === user.userId) {
        await prisma.guestAccount.update({ where: { id: guestId }, data: { isBanned: !guest.isBanned } });
        revalidatePath(`/${user.username}/${guest.voteSession.id}/settings`);
    }
}

export async function loginGuest(formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;
  const guest = await prisma.guestAccount.findFirst({
    where: { username: { equals: username, mode: 'insensitive' }, password: password },
    include: { voteSession: { include: { host: true } } }
  });
  if (!guest) {
      logger.warn({ username, type: 'guest_login_fail' }, 'Invalid Guest Creds');
      redirect('/join?error=Invalid credentials');
  }
  if (guest.isBanned) redirect('/join?error=Access denied');
  cookies().set('guest_id', guest.id, { httpOnly: false, path: '/', maxAge: 60 * 60 * 24 });
  logger.info({ guestId: guest.id, sessionId: guest.voteSessionId }, 'Guest Logged In');
  redirect(`/${guest.voteSession.host.username}/${guest.voteSession.id}`);
}

export async function addToBlacklist(type: 'SONG_ID' | 'KEYWORD', value: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');
    await prisma.blacklist.create({ data: { hostId: user.userId, type, value } });
    revalidatePath(`/${user.username}/settings`);
}

export async function removeFromBlacklist(id: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');
    await prisma.blacklist.delete({ where: { id, hostId: user.userId } });
    revalidatePath(`/${user.username}/settings`);
}

export async function getBlacklist() {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');
    return await prisma.blacklist.findMany({ where: { hostId: user.userId }, orderBy: { createdAt: 'desc' } });
}

export async function getSessionHistory(sessionId: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');
    return await prisma.queueItem.findMany({ where: { voteSessionId: sessionId, status: 'PLAYED' }, include: { song: true, guest: true }, orderBy: { updatedAt: 'desc' } });
}

export async function getSessionAnalytics(sessionId: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');
    const totalVotes = await prisma.queueItem.aggregate({ where: { voteSessionId: sessionId }, _sum: { voteCount: true } });
    const topSongs = await prisma.queueItem.findMany({ where: { voteSessionId: sessionId }, orderBy: { voteCount: 'desc' }, take: 5, include: { song: true } });
    return { totalVotes: totalVotes._sum.voteCount || 0, topSongs };
}

export async function getSessionStats(sessionId: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');
    const guests = await prisma.guestAccount.findMany({ where: { voteSessionId: sessionId } });
    const host = await prisma.host.findUnique({ where: { id: user.userId } });
    const usersToCheck = [
        { id: user.userId, name: `${host?.username} (Host)`, isHost: true, permissions: null },
        ...guests.map(g => ({ id: g.id, name: g.username, isHost: false, permissions: g.permissions as unknown as Permissions }))
    ];
    const stats = [];
    for (const u of usersToCheck) {
        const historyKey = `session_votes:${sessionId}:${u.id}`;
        const cooldownKey = `session_cooldown:${sessionId}:${u.id}`;
        const votesUsed = await redis.scard(historyKey);
        const ttl = await redis.ttl(cooldownKey);
        const dbGuest = guests.find(g => g.id === u.id);
        const karma = dbGuest ? dbGuest.karma : 0;
        stats.push({ id: u.id, name: u.name, votesUsed, timeLeft: ttl > 0 ? ttl : 0, permissions: u.permissions, isHost: u.isHost, karma });
    }
    return stats;
}

export async function resetSessionTimer(sessionId: string, targetUserId?: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');
    if (targetUserId) {
        await redis.del(`session_votes:${sessionId}:${targetUserId}`);
        await redis.del(`session_cooldown:${sessionId}:${targetUserId}`);
    } else {
        const guests = await prisma.guestAccount.findMany({ where: { voteSessionId: sessionId } });
        const allIds = [user.userId, ...guests.map(g => g.id)];
        const keysToDelete = [];
        for (const id of allIds) { keysToDelete.push(`session_votes:${sessionId}:${id}`); keysToDelete.push(`session_cooldown:${sessionId}:${id}`); }
        if (keysToDelete.length > 0) await redis.del(...keysToDelete);
    }
    revalidatePath(`/${user.username}/${sessionId}/settings`);
}

export async function updateGuestPermissions(guestId: string, permissions: Partial<Permissions>) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');
    const guest = await prisma.guestAccount.findUnique({ where: { id: guestId } });
    if (!guest) return;
    const session = await prisma.voteSession.findUnique({ where: { id: guest.voteSessionId } });
    if (session?.hostId !== user.userId) throw new Error('Unauthorized');
    const current = (guest.permissions as unknown as Permissions) || {};
    const updated = { ...current, ...permissions };
    await prisma.guestAccount.update({ where: { id: guestId }, data: { permissions: updated as any } });
    logger.info({ userId: user.userId, guestId, permissions }, 'Guest Permissions Updated');
    revalidatePath(`/${user.username}/${session.id}/settings`);
}

export async function updateSessionDefaultPermissions(sessionId: string, permissions: Permissions) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');
    await prisma.voteSession.update({ where: { id: sessionId, hostId: user.userId }, data: { defaultPermissions: permissions as any } });
    revalidatePath(`/${user.username}/${sessionId}/settings`);
}

export async function getAdminDashboardData() {
    const user = await getCurrentUser();
    if (!user || user.userId !== process.env.SUPER_ADMIN_ID) throw new Error("Unauthorized Access: Super Admin Only");

    const [hostCount, sessionCount, activeSessionCount, totalVotesAgg, hosts, recentItems] = await Promise.all([
        prisma.host.count({ where: { deletedAt: null } }),
        prisma.voteSession.count(),
        prisma.voteSession.count({ where: { isActive: true } }),
        prisma.queueItem.aggregate({ _sum: { voteCount: true } }),
        prisma.host.findMany({ 
            take: 20, 
            orderBy: { createdAt: 'desc' }, 
            include: { _count: { select: { votes: true } } } 
        }),
        prisma.queueItem.findMany({ where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }, select: { createdAt: true } })
    ]);

    const chartDataMap = new Map<string, number>();
    recentItems.forEach(item => {
        const dateKey = item.createdAt.toISOString().split('T')[0];
        chartDataMap.set(dateKey, (chartDataMap.get(dateKey) || 0) + 1);
    });

    const chartArray = Array.from(chartDataMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a,b) => a.date.localeCompare(b.date));

    return {
        kpis: { totalHosts: hostCount, totalSessions: sessionCount, activeSessions: activeSessionCount, totalVotes: totalVotesAgg._sum.voteCount || 0 },
        hosts: hosts.map(h => ({ 
            id: h.id, 
            username: h.username, 
            createdAt: h.createdAt, 
            sessionCount: h._count.votes,
            isBanned: h.isBanned,      
            deletedAt: h.deletedAt,
            banReason: h.banReason 
        })),
        chart: chartArray
    };
}

export async function toggleHostBan(hostId: string, reason?: string) {
    const user = await getCurrentUser();
    if (!user || user.userId !== process.env.SUPER_ADMIN_ID) throw new Error("Unauthorized");
    const host = await prisma.host.findUnique({ where: { id: hostId } });
    if (host) {
        const newBanStatus = !host.isBanned;
        await prisma.host.update({ where: { id: hostId }, data: { isBanned: newBanStatus, banReason: newBanStatus ? reason : null } });
        logger.warn({ adminId: user.userId, targetHostId: hostId, action: newBanStatus ? 'BAN' : 'UNBAN', reason }, 'Host Ban Toggled');
        revalidatePath('/admin');
    }
}

export async function softDeleteHost(hostId: string, reason?: string) {
    const user = await getCurrentUser();
    if (!user || user.userId !== process.env.SUPER_ADMIN_ID) throw new Error("Unauthorized");
    await prisma.host.update({ where: { id: hostId }, data: { deletedAt: new Date(), banReason: reason } });
    logger.warn({ adminId: user.userId, targetHostId: hostId, reason }, 'Host Soft Deleted');
    revalidatePath('/admin');
}

export async function restoreHost(hostId: string) {
    const user = await getCurrentUser();
    if (!user || user.userId !== process.env.SUPER_ADMIN_ID) throw new Error("Unauthorized");
    await prisma.host.update({ where: { id: hostId }, data: { deletedAt: null, banReason: null } });
    logger.info({ adminId: user.userId, targetHostId: hostId }, 'Host Restored');
    revalidatePath('/admin');
}

const ANNOUNCEMENT_KEY = 'active_global_announcement';

export async function sendGlobalAnnouncement(message: string, type: 'info' | 'warning' | 'error') {
    const user = await getCurrentUser();
    if (!user || user.userId !== process.env.SUPER_ADMIN_ID) throw new Error("Unauthorized");
    if (!message.trim()) return;
    const payload = { message, type, timestamp: Date.now() };
    await redis.set(ANNOUNCEMENT_KEY, JSON.stringify(payload));
    await redis.publish('global_announcements', JSON.stringify(payload));
    logger.info({ adminId: user.userId, message }, 'Global Announcement Sent');
    revalidatePath('/');
}

export async function clearGlobalAnnouncement() {
    const user = await getCurrentUser();
    if (!user || user.userId !== process.env.SUPER_ADMIN_ID) throw new Error("Unauthorized");
    await redis.del(ANNOUNCEMENT_KEY);
    await redis.publish('global_announcements', JSON.stringify({ message: null })); 
    revalidatePath('/');
}

export async function getGlobalAnnouncement() {
    const data = await redis.get(ANNOUNCEMENT_KEY);
    return data ? JSON.parse(data) : null;
}