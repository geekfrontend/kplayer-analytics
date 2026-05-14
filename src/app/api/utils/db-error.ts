/**
 * Mengambil kode error dari database error (PostgreSQL).
 * PostgreSQL unique violation: "23505"
 */
export function getDbErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }
  const candidate = error as { code?: unknown };
  return typeof candidate.code === "string" ? candidate.code : null;
}

export const PG_UNIQUE_VIOLATION = "23505";
