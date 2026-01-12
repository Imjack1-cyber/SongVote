type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogPayload {
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  timestamp: string;
  url: string;
  userAgent: string;
}

const sendToServer = async (payload: LogPayload) => {
  try {
    // Use sendBeacon if available for better reliability on page unload
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon('/api/log', blob);
    } else {
      await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true, // Attempt to complete request even if tab closes
      });
    }
  } catch (e) {
    // Prevent infinite loops: Do not log logging errors to the logger
    console.error('Failed to send log to server:', e);
  }
};

class ClientLogger {
  private formatMessage(message: string, context?: any) {
    return context ? [message, context] : [message];
  }

  private createPayload(level: LogLevel, message: string, context?: any): LogPayload {
    return {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : '',
    };
  }

  info(message: string, context?: Record<string, any>) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[INFO] ${message}`, context || '');
    }
  }

  warn(message: string, context?: Record<string, any>) {
    console.warn(`[WARN] ${message}`, context || '');
    // Optionally send warnings to server
    // sendToServer(this.createPayload('warn', message, context));
  }

  error(message: string, context?: any) {
    console.error(`[ERROR] ${message}`, context || '');
    
    // Always report client-side errors to server
    // We try/catch the formatting to ensure we don't crash the logger
    try {
        const serializableContext = context instanceof Error 
            ? { name: context.name, message: context.message, stack: context.stack }
            : context;
            
        sendToServer(this.createPayload('error', message, serializableContext));
    } catch (e) {
        console.error("Error serializing log context", e);
    }
  }

  debug(message: string, context?: Record<string, any>) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${message}`, context || '');
    }
  }
}

export const clientLogger = new ClientLogger();