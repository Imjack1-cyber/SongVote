import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'password',
      'passwordHash',
      'token',
      'session_token',
      'youtubeApiKey',
      '*.password',
      '*.token'
    ],
    remove: true,
  },
  // In dev, use pino-pretty for readability. In prod, use standard JSON for aggregators.
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'HH:MM:ss',
        },
      }
    : undefined,
  serializers: {
    // Standardize error serialization
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
});

export const log = logger;