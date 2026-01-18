import { NextRequest } from 'next/server';
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
    
    const result = LogSchema.safeParse(body);
    
    if (!result.success) {
      return new Response(JSON.stringify({ error: 'Invalid log format' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
      });
    }

    const { level, message, context, url, userAgent } = result.data;

    const logData = {
      source: 'client',
      url,
      userAgent,
      clientContext: context
    };

    if (level === 'error') {
      logger.error(logData, message);
    } else if (level === 'warn') {
      logger.warn(logData, message);
    } else {
      logger.info(logData, message);
    }

    return new Response(JSON.stringify({ success: true }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // Console error to server terminal for debugging
    console.error('Failed to process client log:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
    });
  }
}