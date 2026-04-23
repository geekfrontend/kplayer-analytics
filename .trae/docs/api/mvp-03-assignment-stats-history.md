# MVP 3 - Assignment, Stats, History

## 1. Tujuan MVP

Menyelesaikan core domain performa pemain:

- assignment pemain ke club per season,
- input/update statistik pemain,
- histori perubahan statistik otomatis.

## 2. Fitur

- CRUD `player_club_history`.
- CRUD `player_stats` (dengan batasan domain).
- Auto-write `player_stats_history` setiap update stats.
- Audit field (`created_by`, `updated_by`, `changed_by`) aktif.
- Handler memakai `RouteHandler` agar error format konsisten.

## 3. Skema Database (SQLite Snapshot)

```sql
PRAGMA foreign_keys = ON;

-- MVP 1 + MVP 2 tables
-- + tabel baru:

CREATE TABLE player_club_history (
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
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE RESTRICT
);

CREATE TABLE player_stats (
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

CREATE TABLE player_stats_history (
  id TEXT PRIMARY KEY,
  player_stats_id TEXT NOT NULL,
  before_payload TEXT NOT NULL, -- json string
  after_payload TEXT NOT NULL,  -- json string
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  FOREIGN KEY (player_stats_id) REFERENCES player_stats(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE RESTRICT
);
```

## 4. Endpoint API

### Player Club History

- `GET /api/player-club-history`
- `POST /api/player-club-history` (admin)
- `PATCH /api/player-club-history/:id` (admin)
- `DELETE /api/player-club-history/:id` (admin)

### Player Stats

- `GET /api/player-stats`
- `POST /api/player-stats` (admin)
- `PATCH /api/player-stats/:id` (admin)
- `GET /api/player-stats/:id`
- `GET /api/player-stats/:id/history`

Catatan implementasi:

- Response sukses gunakan `ApiResponse.ok` / `ApiResponse.created`.
- Error domain gunakan `ApiError.badRequest`, `ApiError.conflict`, `ApiError.notFound`.
- Wajib transaksi SQLite pada proses update stats + insert history.

## 5. Validasi Data Inti

- `leave_date >= join_date` jika `leave_date` tidak null.
- Satu player tidak boleh punya dua assignment aktif pada season yang sama.
- Stats hanya boleh dibuat jika assignment player-season-club valid.
- `shots >= goals`, semua nilai stats non-negatif.

## 6. Error Handling

- Assignment invalid -> `400 VALIDATION_ERROR`
- Assignment duplicate/overlap -> `409 CONFLICT`
- Stats update ke data yang tidak ada -> `404 NOT_FOUND`
- Gagal tulis history -> rollback transaksi + `500 INTERNAL_ERROR`

## 7. Unit Test Minimum

- Create assignment sukses.
- Create assignment gagal (dua assignment aktif season sama).
- Create stats sukses.
- Update stats membuat 1 row baru di `player_stats_history`.
- Update stats invalid (`shots < goals`) gagal.
- Error rollback saat history gagal insert.

## 8. Definition of Done (DoD)

- Stats & history berjalan konsisten dalam transaksi.
- Semua rule domain utama tervalidasi.
- Test modul `assignments` dan `stats` lulus.
