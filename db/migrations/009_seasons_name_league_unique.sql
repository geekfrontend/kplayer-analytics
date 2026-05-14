-- Nama musim tidak perlu unik secara global.
-- Musim yang sama (misal 2026/2027) bisa ada di liga berbeda.
-- Keunikan dijamin per kombinasi (name, league_id).
ALTER TABLE seasons DROP CONSTRAINT IF EXISTS seasons_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_seasons_name_league
  ON seasons(name, league_id);
