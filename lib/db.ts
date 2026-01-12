import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const prismaClientSingleton = () => {
  const client = new PrismaClient({
    log: [
      { level: 'warn', emit: 'event' },
      { level: 'error', emit: 'event' },
    ],
  });

  // Hook Prisma events into Pino
  client.$on('warn', (e) => {
    logger.warn({ target: e.target, message: e.message }, 'Prisma Warning');
  });

  client.$on('error', (e) => {
    logger.error({ target: e.target, message: e.message }, 'Prisma Error');
  });

  return client;
};

export const prisma = globalForPrisma.prisma || prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;