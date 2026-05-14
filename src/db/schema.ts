import {
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "analyst"] }).notNull(),
  active_season_id: text("active_season_id"),
  active_league_id: text("active_league_id"),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
  deleted_at: text("deleted_at"),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  user_id: text("user_id").notNull(),
  token: text("token").notNull().unique(),
  expires_at: text("expires_at").notNull(),
  created_at: text("created_at").notNull(),
});

export const leagues = pgTable("leagues", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  country: text("country").notNull(),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
  deleted_at: text("deleted_at"),
});

export const seasons = pgTable(
  "seasons",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    league_id: text("league_id").references(() => leagues.id, {
      onDelete: "restrict",
    }),
    start_date: text("start_date").notNull(),
    end_date: text("end_date").notNull(),
    is_active: integer("is_active").notNull().default(0),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
    deleted_at: text("deleted_at"),
  },
  (table) => [
    uniqueIndex("uq_seasons_name_league").on(table.name, table.league_id),
  ],
);

export const clubs = pgTable("clubs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
  deleted_at: text("deleted_at"),
});

export const players = pgTable("players", {
  id: text("id").primaryKey(),
  full_name: text("full_name").notNull(),
  date_of_birth: text("date_of_birth").notNull(),
  nationality: text("nationality"),
  primary_position: text("primary_position").notNull(),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

export const season_clubs = pgTable(
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
  (table) => [
    uniqueIndex("uq_season_clubs_pair").on(table.season_id, table.club_id),
    index("idx_season_clubs_season").on(table.season_id),
    index("idx_season_clubs_club").on(table.club_id),
  ],
);

export const player_club_history = pgTable(
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
  (table) => [
    index("idx_player_club_history_player_season").on(
      table.player_id,
      table.season_id,
    ),
    index("idx_player_club_history_club_season").on(
      table.club_id,
      table.season_id,
    ),
  ],
);

export const player_stats = pgTable(
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
  (table) => [
    uniqueIndex("uq_player_stats_scope").on(
      table.player_id,
      table.season_id,
      table.club_id,
    ),
    index("idx_player_stats_season_club").on(table.season_id, table.club_id),
    index("idx_player_stats_player_season").on(
      table.player_id,
      table.season_id,
    ),
    index("idx_player_stats_goals").on(table.goals),
    index("idx_player_stats_assists").on(table.assists),
  ],
);

export const player_stats_history = pgTable(
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
  (table) => [
    index("idx_player_stats_history_changed_at").on(table.changed_at),
    index("idx_player_stats_history_stats_changed").on(
      table.player_stats_id,
      table.changed_at,
    ),
  ],
);
