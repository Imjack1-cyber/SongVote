// ========================================================================
// FILE: app/[hostname]/[voteId]/print/page.tsx
// ========================================================================

import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { checkPermission } from '@/lib/permissions';
import { cookies } from 'next/headers';
import PrintableGuestCards from '@/components/host/PrintableGuestCards';

export default async function PrintCardsPage({ params }: { params: { hostname: string; voteId: string } }) {
  // 1. Get Session
  const session = await prisma.voteSession.findUnique({
    where: { id: params.voteId },
    include: { guests: true }
  });

  if (!session) return notFound();

  // 2. Identify User
  const currentUser = await getCurrentUser();
  const guestId = cookies().get('guest_id')?.value;
  const userId = currentUser?.userId || guestId;

  // 3. Check Permissions
  const isHost = currentUser?.username === params.hostname;
  const canPrint = isHost || (await checkPermission(params.voteId, userId, 'printCards'));

  if (!canPrint) {
      redirect(`/${params.hostname}/${params.voteId}`);
  }

  // 4. Determine Back Link
  const backLink = isHost 
      ? `/${params.hostname}/${params.voteId}/settings`
      : `/${params.hostname}/${params.voteId}`;

  return (
    <PrintableGuestCards 
        guests={session.guests} 
        backLink={backLink} 
    />
  );
}