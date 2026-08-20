export class TimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number, message = `Timed out after ${timeoutMs}ms.`) {
    super(message);
    this.name = "TimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

/** Timeouts for non-LLM I/O (Postgres, GCS). */
export const EXTERNAL_TIMEOUT = {
  dbConnectionMs: 10_000,
  dbQueryMs: 8_000,
  gcsMs: 15_000,
} as const;

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message?: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new TimeoutError(timeoutMs, message));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export function abortAfter(timeoutMs: number, signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(timeoutMs);

  if (!signal) {
    return timeout;
  }

  return AbortSignal.any([signal, timeout]);
}
