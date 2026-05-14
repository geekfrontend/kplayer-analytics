-- Soft delete untuk leagues, seasons, clubs
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS deleted_at TEXT;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS deleted_at TEXT;
ALTER TABLE clubs   ADD COLUMN IF NOT EXISTS deleted_at TEXT;
