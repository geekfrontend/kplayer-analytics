-- Tabel master liga
CREATE TABLE IF NOT EXISTS leagues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leagues_name ON leagues(name);

-- Tambah league_id ke seasons
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS league_id TEXT REFERENCES leagues(id) ON DELETE RESTRICT;

-- Hapus kolom country dari clubs (tidak relevan lagi, liga diketahui dari season)
ALTER TABLE clubs DROP COLUMN IF EXISTS country;
