import { NextResponse } from 'next/server';
import { getCurrentUser, logoutUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET() {
  const userSession = await getCurrentUser();
  
  if (!userSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
      // Double check DB status
      const host = await prisma.host.findUnique({
          where: { id: userSession.userId },
          select: { isBanned: true, deletedAt: true }
      });

      if (!host) {
          logger.warn({ userId: userSession.userId }, 'Auth Check: User not found in DB');
          await logoutUser();
          return NextResponse.json({ error: 'User Not Found' }, { status: 404 });
      }

      if (host.isBanned || host.deletedAt) {
          logger.warn({ userId: userSession.userId, isBanned: host.isBanned, deleted: !!host.deletedAt }, 'Auth Check: User Suspended');
          await logoutUser();
          return NextResponse.json({ error: 'Account Suspended' }, { status: 403 });
      }

      return NextResponse.json({ 
          userId: userSession.userId, 
          username: userSession.username 
      });
  } catch (e) {
      logger.error({ err: e, userId: userSession.userId }, 'Auth Check DB Error');
      return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}