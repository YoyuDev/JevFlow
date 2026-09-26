import type { LogLevel, LogMeta, Logger } from '../types/index.js';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 99,
};

/** One-line structured logs: timestamp + level + scope + message + JSON meta. */
export class ConsoleLogger implements Logger {
  private readonly scope: string;
  private readonly level: LogLevel;

  constructor(scope = 'jevflow', level: LogLevel = 'info') {
    this.scope = scope;
    this.level = level;
  }

  debug(message: string, meta?: LogMeta): void {
    this.write('debug', message, meta);
  }

  info(message: string, meta?: LogMeta): void {
    this.write('info', message, meta);
  }

  warn(message: string, meta?: LogMeta): void {
    this.write('warn', message, meta);
  }

  error(message: string, meta?: LogMeta): void {
    this.write('error', message, meta);
  }

  private write(level: Exclude<LogLevel, 'silent'>, message: string, meta?: LogMeta): void {
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[this.level]) return;
    const head = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${this.scope}] ${message}`;
    const line = meta && Object.keys(meta).length > 0 ? `${head} ${safeJson(meta)}` : head;
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }
}

/** Used by tests and as the engine's default so a bare `new WorkflowEngine()` stays quiet. */
export class SilentLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

export function createLogger(scope?: string, level?: LogLevel): Logger {
  return new ConsoleLogger(scope, level);
}

function safeJson(value: unknown): string {
  try {
    const json = JSON.stringify(value);
    return json === undefined ? String(value) : json;
  } catch {
    return '"<unserializable>"';
  }
}
