import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

