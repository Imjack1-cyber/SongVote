import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redis } from '@/lib/redis';
import VoteSessionClient from './VoteSessionClient';

interface VotePageProps {
  params: { hostname: string; voteId: string };
}

export default async function VotePage({ params }: VotePageProps) {
  const session = await prisma.voteSession.findFirst({
    where: { 
        id: params.voteId,
        host: { username: params.hostname }
    }
  });

  if (!session) return notFound();

  const currentUser = await getCurrentUser();
  const isHost = currentUser?.username === params.hostname;

  const guestId = cookies().get('guest_id')?.value;
  const voterId = isHost ? currentUser?.userId : guestId;

  // 1. Queue (LIVE)
  const initialQueue = await prisma.queueItem.findMany({
    where: { voteSessionId: params.voteId, status: 'LIVE' },
    include: { song: true },
    orderBy: { voteCount: 'desc' }
  });

  // 2. Current (PLAYING)
  const initialCurrent = await prisma.queueItem.findFirst({
    where: { voteSessionId: params.voteId, status: 'PLAYING' },
    include: { song: true }
  });

  // 3. History (PLAYED)
  const initialHistory = await prisma.queueItem.findMany({
    where: { voteSessionId: params.voteId, status: 'PLAYED' },
    include: { song: true },
    orderBy: { updatedAt: 'desc' }
  });

  // 4. User Stats
  let initialSubmittedIds: string[] = [];
  let initialTimeLeft = 0;
  let userPermissions = null;

  if (voterId) {
      const historyKey = `session_votes:${params.voteId}:${voterId}`;
      initialSubmittedIds = await redis.smembers(historyKey);

      const cooldownKey = `session_cooldown:${params.voteId}:${voterId}`;
      const ttl = await redis.ttl(cooldownKey);
      initialTimeLeft = ttl > 0 ? ttl : 0;

      if (!isHost) {
          const guest = await prisma.guestAccount.findUnique({ where: { id: voterId } });
          if (guest) {
              userPermissions = guest.permissions;
          }
      }
  }

  const syncKey = `session_playback:${params.voteId}`;
  const rawSync = await redis.get(syncKey);
  const initialPlaybackState = rawSync ? JSON.parse(rawSync) : null;

  return (
    <VoteSessionClient 
      hostName={params.hostname} 
      voteId={params.voteId} 
      isHost={isHost}
      voterId={voterId || null}
      initialQueue={initialQueue}
      initialCurrent={initialCurrent}
      initialHistory={initialHistory}
      initialPlaybackState={initialPlaybackState}
      votesPerUser={session.votesPerUser}
      cycleDelayMinutes={session.cycleDelay}
      initialSubmittedIds={initialSubmittedIds}
      initialTimeLeft={initialTimeLeft}
      userPermissions={userPermissions}
      enableReactions={session.enableReactions}
    />
  );
}