import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import VisualizerClient from '@/components/visualizer/VisualizerClient';

export default async function VisualizerPage({ params }: { params: { hostname: string; voteId: string } }) {
  const session = await prisma.voteSession.findFirst({
    where: { 
        id: params.voteId,
        host: { username: params.hostname }
    }
  });

  if (!session) return notFound();

  // Initial State
  const initialQueue = await prisma.queueItem.findMany({
    where: { voteSessionId: params.voteId, status: 'LIVE' },
    include: { song: true },
    orderBy: { voteCount: 'desc' },
    take: 5 // Only show top 5 on TV
  });

  const initialCurrent = await prisma.queueItem.findFirst({
    where: { voteSessionId: params.voteId, status: 'PLAYING' },
    include: { song: true }
  });

  return (
    <VisualizerClient 
        voteId={params.voteId}
        initialQueue={initialQueue}
        initialCurrent={initialCurrent}
        sessionTitle={session.title}
        hostname={params.hostname}
    />
  );
}