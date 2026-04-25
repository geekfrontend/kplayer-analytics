PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS season_clubs (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  club_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE RESTRICT,
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE RESTRICT,
  UNIQUE (season_id, club_id)
);

CREATE TABLE IF NOT EXISTS player_club_history (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  club_id TEXT NOT NULL,
  join_date TEXT NOT NULL,
  leave_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE RESTRICT,
  FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE RESTRICT,
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE RESTRICT,
  CHECK (leave_date IS NULL OR leave_date >= join_date)
);

CREATE TABLE IF NOT EXISTS player_stats (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  club_id TEXT NOT NULL,
  minutes_played INTEGER NOT NULL CHECK (minutes_played >= 0),
  goals INTEGER NOT NULL CHECK (goals >= 0),
  assists INTEGER NOT NULL CHECK (assists >= 0),
  shots INTEGER NOT NULL CHECK (shots >= goals),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE RESTRICT,
  FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE RESTRICT,
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE (player_id, season_id, club_id)
);

CREATE TABLE IF NOT EXISTS player_stats_history (
  id TEXT PRIMARY KEY,
  player_stats_id TEXT NOT NULL,
  before_payload TEXT NOT NULL,
  after_payload TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  FOREIGN KEY (player_stats_id) REFERENCES player_stats(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE RESTRICT
);
