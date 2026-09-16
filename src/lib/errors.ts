const TECHNICAL_ERROR_PATTERNS = [
  /row-level security/i,
  /violates .* constraint/i,
  /permission denied/i,
  /relation .* does not exist/i,
  /column .* does not exist/i,
  /syntax error/i,
  /duplicate key value/i,
  /invalid input syntax/i,
  /postgrest/i,
  /pgrst\d+/i,
  /postgres/i,
];

function readMessage(error: unknown): string | null {
  if (error instanceof Error && error.message) return error.message;

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }

  return null;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  const message = readMessage(error);
  if (!message) return fallback;

  // Database implementation details are useful in logs, but they are confusing
  // and occasionally revealing in the UI. Keep intentional domain/auth messages
  // while replacing low-level Postgres/PostgREST failures with contextual copy.
  if (TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
    return fallback;
  }

  return message;
}
