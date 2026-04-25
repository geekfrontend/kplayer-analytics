PRAGMA foreign_keys = ON;

CREATE INDEX IF NOT EXISTS idx_season_clubs_season
  ON season_clubs(season_id);

CREATE INDEX IF NOT EXISTS idx_season_clubs_club
  ON season_clubs(club_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_season_clubs_pair
  ON season_clubs(season_id, club_id);

CREATE INDEX IF NOT EXISTS idx_player_club_history_player_season
  ON player_club_history(player_id, season_id);

CREATE INDEX IF NOT EXISTS idx_player_club_history_club_season
  ON player_club_history(club_id, season_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_player_stats_scope
  ON player_stats(player_id, season_id, club_id);

CREATE INDEX IF NOT EXISTS idx_player_stats_season_club
  ON player_stats(season_id, club_id);

CREATE INDEX IF NOT EXISTS idx_player_stats_player_season
  ON player_stats(player_id, season_id);

CREATE INDEX IF NOT EXISTS idx_player_stats_goals
  ON player_stats(goals DESC);

CREATE INDEX IF NOT EXISTS idx_player_stats_assists
  ON player_stats(assists DESC);

CREATE INDEX IF NOT EXISTS idx_player_stats_history_changed_at
  ON player_stats_history(changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_player_stats_history_stats_changed
  ON player_stats_history(player_stats_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_players_full_name
  ON players(full_name);
