type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

const LEVELS: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

function currentLevel(): number {
  const env = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  for (const [label, level] of Object.entries(LEVELS)) {
    if (label === env) return level;
  }
  return LEVELS.info;
}

interface LogEntry {
  level: number;
  time: string;
  msg: string;
  [key: string]: unknown;
}

function write(entry: LogEntry): void {
  const line = JSON.stringify(entry);
  if (entry.level >= LEVELS.error) {
    console.error(line);
  } else {
    console.log(line);
  }
}

export interface Logger {
  trace: (msg: string, ctx?: Record<string, unknown>) => void;
  debug: (msg: string, ctx?: Record<string, unknown>) => void;
  info: (msg: string, ctx?: Record<string, unknown>) => void;
  warn: (msg: string, ctx?: Record<string, unknown>) => void;
  error: (msg: string, ctx?: Record<string, unknown>) => void;
  fatal: (msg: string, ctx?: Record<string, unknown>) => void;
  child: (bindings: Record<string, unknown>) => Logger;
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      error: err.message,
      stack: err.stack,
      cause: err.cause ? serializeError(err.cause) : undefined,
    };
  }
  return { error: String(err) };
}

function createLogger(bindings: Record<string, unknown> = {}): Logger {
  const threshold = currentLevel();

  function log(
    level: number,
    msg: string,
    ctx?: Record<string, unknown>,
  ): void {
    if (level < threshold) return;

    const entry: LogEntry = {
      level,
      time: new Date().toISOString(),
      msg,
      ...bindings,
      ...ctx,
    };

    write(entry);
  }

  return {
    trace(msg, ctx) {
      log(LEVELS.trace, msg, ctx);
    },
    debug(msg, ctx) {
      log(LEVELS.debug, msg, ctx);
    },
    info(msg, ctx) {
      log(LEVELS.info, msg, ctx);
    },
    warn(msg, ctx) {
      log(LEVELS.warn, msg, ctx);
    },
    error(msg, ctx) {
      log(LEVELS.error, msg, { ...ctx, ...serializeError(bindings.err) });
    },
    fatal(msg, ctx) {
      log(LEVELS.fatal, msg, ctx);
    },
    child(bindings: Record<string, unknown>) {
      return createLogger({ ...bindings, ...bindings });
    },
  };
}

export const logger = createLogger();
