import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "analyst"] }).notNull(),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
  deleted_at: text("deleted_at"),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  user_id: text("user_id").notNull(),
  token: text("token").notNull().unique(),
  expires_at: text("expires_at").notNull(),
  created_at: text("created_at").notNull(),
});

export const seasons = sqliteTable("seasons", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  start_date: text("start_date").notNull(),
  end_date: text("end_date").notNull(),
  is_active: integer("is_active").notNull().default(0),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
  deleted_at: text("deleted_at"),
});

export const clubs = sqliteTable("clubs", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  country: text("country"),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  full_name: text("full_name").notNull(),
  date_of_birth: text("date_of_birth").notNull(),
  nationality: text("nationality"),
  primary_position: text("primary_position").notNull(),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

export const season_clubs = sqliteTable(
  "season_clubs",
  {
    id: text("id").primaryKey(),
    season_id: text("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "restrict" }),
    club_id: text("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "restrict" }),
    created_at: text("created_at").notNull(),
  },
  (table) => ({
    uqSeasonClubPair: uniqueIndex("uq_season_clubs_pair").on(
      table.season_id,
      table.club_id,
    ),
    idxSeasonClubsSeason: index("idx_season_clubs_season").on(table.season_id),
    idxSeasonClubsClub: index("idx_season_clubs_club").on(table.club_id),
  }),
);

export const player_club_history = sqliteTable(
  "player_club_history",
  {
    id: text("id").primaryKey(),
    player_id: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    season_id: text("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "restrict" }),
    club_id: text("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "restrict" }),
    join_date: text("join_date").notNull(),
    leave_date: text("leave_date"),
    is_active: integer("is_active").notNull().default(1),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (table) => ({
    idxPlayerClubHistoryPlayerSeason: index(
      "idx_player_club_history_player_season",
    ).on(table.player_id, table.season_id),
    idxPlayerClubHistoryClubSeason: index(
      "idx_player_club_history_club_season",
    ).on(table.club_id, table.season_id),
  }),
);

export const player_stats = sqliteTable(
  "player_stats",
  {
    id: text("id").primaryKey(),
    player_id: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    season_id: text("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "restrict" }),
    club_id: text("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "restrict" }),
    minutes_played: integer("minutes_played").notNull(),
    goals: integer("goals").notNull(),
    assists: integer("assists").notNull(),
    shots: integer("shots").notNull(),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
    created_by: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    updated_by: text("updated_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
  },
  (table) => ({
    uqPlayerStatsScope: uniqueIndex("uq_player_stats_scope").on(
      table.player_id,
      table.season_id,
      table.club_id,
    ),
    idxPlayerStatsSeasonClub: index("idx_player_stats_season_club").on(
      table.season_id,
      table.club_id,
    ),
    idxPlayerStatsPlayerSeason: index("idx_player_stats_player_season").on(
      table.player_id,
      table.season_id,
    ),
    idxPlayerStatsGoals: index("idx_player_stats_goals").on(table.goals),
    idxPlayerStatsAssists: index("idx_player_stats_assists").on(table.assists),
  }),
);

export const player_stats_history = sqliteTable(
  "player_stats_history",
  {
    id: text("id").primaryKey(),
    player_stats_id: text("player_stats_id")
      .notNull()
      .references(() => player_stats.id, { onDelete: "cascade" }),
    before_payload: text("before_payload").notNull(),
    after_payload: text("after_payload").notNull(),
    changed_by: text("changed_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    changed_at: text("changed_at").notNull(),
  },
  (table) => ({
    idxPlayerStatsHistoryChangedAt: index("idx_player_stats_history_changed_at").on(
      table.changed_at,
    ),
    idxPlayerStatsHistoryStatsChanged: index(
      "idx_player_stats_history_stats_changed",
    ).on(table.player_stats_id, table.changed_at),
  }),
);
