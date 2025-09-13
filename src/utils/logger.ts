export interface Logger {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
  debug: (message: string, meta?: Record<string, unknown>) => void;
}

export function createLogger(enabled: boolean): Logger {
  const log = (level: 'info' | 'warn' | 'error' | 'debug', message: string, meta?: Record<string, unknown>) => {
    if (!enabled && level === 'debug') return;
    const time = new Date().toISOString();
    const payload = meta ? ` ${JSON.stringify(meta)}` : '';
    // eslint-disable-next-line no-console
    console[level](`[${time}] [${level}] ${message}${payload}`);
  };

  return {
    info: (m, meta) => log('info', m, meta),
    warn: (m, meta) => log('warn', m, meta),
    error: (m, meta) => log('error', m, meta),
    debug: (m, meta) => log('debug', m, meta),
  };
}


