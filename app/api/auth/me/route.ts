import { NextResponse } from 'next/server';
import { getCurrentUser, logoutUser } from '@/lib/auth'; // Ensure logoutUser is exported from lib/auth
import { prisma } from '@/lib/db';

export async function GET() {
  const userSession = await getCurrentUser();
  
  if (!userSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Double check DB status
  const host = await prisma.host.findUnique({
      where: { id: userSession.userId },
      select: { isBanned: true, deletedAt: true }
  });

  if (!host || host.isBanned || host.deletedAt) {
      // Force cookie clear if caught here
      await logoutUser();
      return NextResponse.json({ error: 'Account Suspended' }, { status: 403 });
  }

  return NextResponse.json({ 
      userId: userSession.userId, 
      username: userSession.username 
  });
}