export interface LogEvent {
  timestamp?: string;
  level?: 'info' | 'warn' | 'error' | 'debug';
  event?: string;
  userId?: string;
  battleId?: string;
  durationMs?: number;
  details?: any;
  error?: string;
  [key: string]: any;
}

class StructuredLogger {
  private log(level: 'info' | 'warn' | 'error' | 'debug', event: string, payload: Partial<LogEvent> = {}) {
    const entry: LogEvent = {
      timestamp: new Date().toISOString(),
      level,
      event,
      ...payload
    };

    // Sanitize any accidentally passed secrets/passwords/tokens
    if (entry.details && typeof entry.details === 'object') {
      const sanitized = { ...entry.details };
      ['password', 'token', 'apiKey', 'private_key', 'authorization'].forEach(key => {
        if (sanitized[key]) sanitized[key] = '[REDACTED]';
      });
      entry.details = sanitized;
    }

    const output = JSON.stringify(entry);
    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  info(event: string, payload?: Partial<LogEvent>) {
    this.log('info', event, payload);
  }

  warn(event: string, payload?: Partial<LogEvent>) {
    this.log('warn', event, payload);
  }

  error(event: string, payload?: Partial<LogEvent>) {
    this.log('error', event, payload);
  }

  debug(event: string, payload?: Partial<LogEvent>) {
    this.log('debug', event, payload);
  }
}

export const logger = new StructuredLogger();
export default logger;
