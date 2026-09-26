export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export type LogMeta = Record<string, unknown>;

/** Deliberately tiny — no winston, no pino. Structured enough to grep. */
export interface Logger {
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
}
