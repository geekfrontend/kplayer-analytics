-- Ubah kolom goals, assists, shots dari INTEGER ke REAL agar bisa menerima decimal
ALTER TABLE player_stats ALTER COLUMN goals TYPE REAL USING goals::REAL;
ALTER TABLE player_stats ALTER COLUMN assists TYPE REAL USING assists::REAL;
ALTER TABLE player_stats ALTER COLUMN shots TYPE REAL USING shots::REAL;

-- Drop CHECK constraint lama (integer-based) dan buat ulang untuk REAL
ALTER TABLE player_stats DROP CONSTRAINT IF EXISTS player_stats_goals_check;
ALTER TABLE player_stats DROP CONSTRAINT IF EXISTS player_stats_assists_check;
ALTER TABLE player_stats DROP CONSTRAINT IF EXISTS player_stats_shots_check;

ALTER TABLE player_stats ADD CONSTRAINT player_stats_goals_check CHECK (goals >= 0);
ALTER TABLE player_stats ADD CONSTRAINT player_stats_assists_check CHECK (assists >= 0);
ALTER TABLE player_stats ADD CONSTRAINT player_stats_shots_check CHECK (shots >= goals);
