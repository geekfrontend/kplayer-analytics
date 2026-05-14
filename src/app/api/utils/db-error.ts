/**
 * Mengambil kode error dari database error (PostgreSQL via Drizzle).
 * Drizzle membungkus error pg dalam { query, params, cause } —
 * kode error PostgreSQL ada di error.cause.code, bukan error.code langsung.
 *
 * PostgreSQL unique violation: "23505"
 */
export function getDbErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  // Drizzle wraps pg errors: error.cause.code
  const withCause = error as { cause?: unknown };
  if (withCause.cause && typeof withCause.cause === "object") {
    const cause = withCause.cause as { code?: unknown };
    if (typeof cause.code === "string") {
      return cause.code;
    }
  }

  // Fallback: error.code langsung (pg error tanpa wrapper)
  const direct = error as { code?: unknown };
  if (typeof direct.code === "string") {
    return direct.code;
  }

  return null;
}

export const PG_UNIQUE_VIOLATION = "23505";
