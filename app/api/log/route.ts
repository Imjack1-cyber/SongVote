import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const LogSchema = z.object({
  level: z.enum(['info', 'warn', 'error', 'debug']),
  message: z.string(),
  context: z.any().optional(),
  url: z.string().optional(),
  userAgent: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate payload structure
    const result = LogSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid log format' }, { status: 400 });
    }

    const { level, message, context, url, userAgent } = result.data;

    // Structure the log for Pino
    // We add a 'source' tag to distinguish these from server-internal logs
    const logData = {
      source: 'client',
      url,
      userAgent,
      clientContext: context
    };

    // Log using the appropriate level on the server
    if (level === 'error') {
      logger.error(logData, message);
    } else if (level === 'warn') {
      logger.warn(logData, message);
    } else {
      logger.info(logData, message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    // If logging fails, we fail silently to the client but log internally
    console.error('Failed to process client log:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}