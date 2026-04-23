# ERD - KPlayer Analytics (Aligned with PRD v1.1)

## 1. Gambaran Umum

Dokumen ini merangkum struktur database untuk modul:

- Auth (`users`, `sessions`)
- Master data (`seasons`, `clubs`, `players`)
- Relasi musim-klub (`season_clubs`)
- Riwayat klub pemain (`player_club_history`)
- Statistik dan histori perubahan (`player_stats`, `player_stats_history`)

## 2. Struktur Tabel

### 2.1 `users`

| Kolom         | Tipe      | Constraint                    | Keterangan       |
| ------------- | --------- | ----------------------------- | ---------------- |
| id            | UUID      | PK                            | ID user          |
| name          | text      | NOT NULL                      | Nama user        |
| email         | text      | NOT NULL, UNIQUE              | Email login      |
| password_hash | text      | NOT NULL                      | Hash password    |
| role          | enum      | NOT NULL (`admin`, `analyst`) | Hak akses        |
| created_at    | timestamp | NOT NULL                      | Waktu dibuat     |
| updated_at    | timestamp | NOT NULL                      | Waktu diperbarui |

### 2.2 `sessions`

| Kolom      | Tipe      | Constraint                 | Keterangan           |
| ---------- | --------- | -------------------------- | -------------------- |
| id         | UUID      | PK                         | ID session           |
| user_id    | UUID      | FK -> `users.id`, NOT NULL | Pemilik session      |
| token      | text      | NOT NULL, UNIQUE           | Session token        |
| expires_at | timestamp | NOT NULL                   | Masa berlaku session |
| created_at | timestamp | NOT NULL                   | Waktu dibuat         |

### 2.3 `seasons`

| Kolom      | Tipe      | Constraint       | Keterangan             |
| ---------- | --------- | ---------------- | ---------------------- |
| id         | UUID      | PK               | ID season              |
| name       | text      | NOT NULL, UNIQUE | Format `YYYY/YYYY`     |
| start_date | date      | NOT NULL         | Tanggal mulai season   |
| end_date   | date      | NOT NULL         | Tanggal selesai season |
| is_active  | boolean   | NOT NULL         | Penanda season aktif   |
| created_at | timestamp | NOT NULL         | Waktu dibuat           |
| updated_at | timestamp | NOT NULL         | Waktu diperbarui       |

### 2.4 `clubs`

| Kolom      | Tipe      | Constraint       | Keterangan       |
| ---------- | --------- | ---------------- | ---------------- |
| id         | UUID      | PK               | ID club          |
| name       | text      | NOT NULL, UNIQUE | Nama club        |
| country    | text      | NULLABLE         | Negara club      |
| created_at | timestamp | NOT NULL         | Waktu dibuat     |
| updated_at | timestamp | NOT NULL         | Waktu diperbarui |

### 2.5 `season_clubs`

| Kolom      | Tipe      | Constraint                   | Keterangan            |
| ---------- | --------- | ---------------------------- | --------------------- |
| id         | UUID      | PK                           | ID relasi season-club |
| season_id  | UUID      | FK -> `seasons.id`, NOT NULL | Referensi season      |
| club_id    | UUID      | FK -> `clubs.id`, NOT NULL   | Referensi club        |
| created_at | timestamp | NOT NULL                     | Waktu dibuat          |

Constraint tambahan:

- UNIQUE (`season_id`, `club_id`)

### 2.6 `players`

| Kolom            | Tipe      | Constraint | Keterangan          |
| ---------------- | --------- | ---------- | ------------------- |
| id               | UUID      | PK         | ID player           |
| full_name        | text      | NOT NULL   | Nama lengkap pemain |
| date_of_birth    | date      | NOT NULL   | Tanggal lahir       |
| nationality      | text      | NULLABLE   | Kewarganegaraan     |
| primary_position | text      | NOT NULL   | Posisi utama        |
| created_at       | timestamp | NOT NULL   | Waktu dibuat        |
| updated_at       | timestamp | NOT NULL   | Waktu diperbarui    |

### 2.7 `player_club_history`

| Kolom      | Tipe      | Constraint                   | Keterangan             |
| ---------- | --------- | ---------------------------- | ---------------------- |
| id         | UUID      | PK                           | ID riwayat             |
| player_id  | UUID      | FK -> `players.id`, NOT NULL | Referensi player       |
| season_id  | UUID      | FK -> `seasons.id`, NOT NULL | Referensi season       |
| club_id    | UUID      | FK -> `clubs.id`, NOT NULL   | Referensi club         |
| join_date  | date      | NOT NULL                     | Tanggal bergabung      |
| leave_date | date      | NULLABLE                     | Tanggal keluar         |
| is_active  | boolean   | NOT NULL                     | Status aktif di season |
| created_at | timestamp | NOT NULL                     | Waktu dibuat           |
| updated_at | timestamp | NOT NULL                     | Waktu diperbarui       |

### 2.8 `player_stats`

| Kolom          | Tipe      | Constraint                   | Keterangan       |
| -------------- | --------- | ---------------------------- | ---------------- |
| id             | UUID      | PK                           | ID statistik     |
| player_id      | UUID      | FK -> `players.id`, NOT NULL | Referensi player |
| season_id      | UUID      | FK -> `seasons.id`, NOT NULL | Referensi season |
| club_id        | UUID      | FK -> `clubs.id`, NOT NULL   | Referensi club   |
| minutes_played | int       | NOT NULL, CHECK `>= 0`       | Total menit main |
| goals          | int       | NOT NULL, CHECK `>= 0`       | Total gol        |
| assists        | int       | NOT NULL, CHECK `>= 0`       | Total assist     |
| shots          | int       | NOT NULL, CHECK `>= goals`   | Total tembakan   |
| created_at     | timestamp | NOT NULL                     | Waktu dibuat     |
| updated_at     | timestamp | NOT NULL                     | Waktu diperbarui |
| created_by     | UUID      | FK -> `users.id`, NOT NULL   | Dibuat oleh      |
| updated_by     | UUID      | FK -> `users.id`, NOT NULL   | Diperbarui oleh  |

Constraint tambahan:

- UNIQUE (`player_id`, `season_id`, `club_id`)

### 2.9 `player_stats_history`

| Kolom           | Tipe      | Constraint                        | Keterangan                |
| --------------- | --------- | --------------------------------- | ------------------------- |
| id              | UUID      | PK                                | ID history                |
| player_stats_id | UUID      | FK -> `player_stats.id`, NOT NULL | Referensi statistik utama |
| before_payload  | jsonb     | NOT NULL                          | Snapshot sebelum update   |
| after_payload   | jsonb     | NOT NULL                          | Snapshot sesudah update   |
| changed_by      | UUID      | FK -> `users.id`, NOT NULL        | User yang mengubah        |
| changed_at      | timestamp | NOT NULL                          | Waktu perubahan           |

## 3. Relasi Antar Tabel

- `users` 1..N `sessions`
- `seasons` N..N `clubs` melalui `season_clubs`
- `players` 1..N `player_club_history`
- `seasons` 1..N `player_club_history`
- `clubs` 1..N `player_club_history`
- `players` 1..N `player_stats`
- `seasons` 1..N `player_stats`
- `clubs` 1..N `player_stats`
- `users` 1..N `player_stats` (via `created_by`, `updated_by`)
- `player_stats` 1..N `player_stats_history`
- `users` 1..N `player_stats_history` (via `changed_by`)

## 4. Aturan Validasi Penting

- Format season wajib `YYYY/YYYY`, dan tahun kedua = tahun pertama + 1.
- Satu pemain tidak boleh punya dua assignment aktif pada season yang sama.
- `leave_date` tidak boleh lebih kecil dari `join_date`.
- Setiap update statistik wajib membuat record di `player_stats_history`.
- Data histori bersifat immutable dari UI standar.

## 5. Constraint SQL yang Disarankan

Contoh constraint berikut menjaga integritas data agar selaras dengan aturan bisnis.

```sql
-- seasons: start_date harus sebelum end_date
ALTER TABLE seasons
  ADD CONSTRAINT chk_seasons_date_range
  CHECK (start_date < end_date);

-- seasons: format name wajib YYYY/YYYY
ALTER TABLE seasons
  ADD CONSTRAINT chk_seasons_name_format
  CHECK (name ~ '^[0-9]{4}/[0-9]{4}$');

-- seasons: tahun kedua harus tahun pertama + 1
ALTER TABLE seasons
  ADD CONSTRAINT chk_seasons_name_consecutive
  CHECK (
    split_part(name, '/', 2)::int = split_part(name, '/', 1)::int + 1
  );

-- player_club_history: leave_date tidak boleh sebelum join_date
ALTER TABLE player_club_history
  ADD CONSTRAINT chk_player_club_history_date_order
  CHECK (leave_date IS NULL OR leave_date >= join_date);

-- player_stats: validasi nilai non-negatif
ALTER TABLE player_stats
  ADD CONSTRAINT chk_player_stats_non_negative
  CHECK (
    minutes_played >= 0
    AND goals >= 0
    AND assists >= 0
    AND shots >= 0
  );

-- player_stats: shots tidak boleh lebih kecil dari goals
ALTER TABLE player_stats
  ADD CONSTRAINT chk_player_stats_shots_vs_goals
  CHECK (shots >= goals);
```

## 6. Index yang Direkomendasikan

Index di bawah ini membantu query filter, dashboard, dan histori tetap cepat saat data bertambah.

```sql
CREATE UNIQUE INDEX uq_users_email ON users(email);
CREATE UNIQUE INDEX uq_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user_exp ON sessions(user_id, expires_at);

CREATE UNIQUE INDEX uq_seasons_name ON seasons(name);
CREATE UNIQUE INDEX uq_clubs_name ON clubs(name);
CREATE UNIQUE INDEX uq_season_clubs_pair ON season_clubs(season_id, club_id);

CREATE INDEX idx_player_club_history_player_season
  ON player_club_history(player_id, season_id);
CREATE INDEX idx_player_club_history_club_season
  ON player_club_history(club_id, season_id);

CREATE UNIQUE INDEX uq_player_stats_scope
  ON player_stats(player_id, season_id, club_id);
CREATE INDEX idx_player_stats_season_club
  ON player_stats(season_id, club_id);
CREATE INDEX idx_player_stats_goals_desc
  ON player_stats(goals DESC);
CREATE INDEX idx_player_stats_assists_desc
  ON player_stats(assists DESC);

CREATE INDEX idx_player_stats_history_stats_changed
  ON player_stats_history(player_stats_id, changed_at DESC);
```

## 7. Kebijakan FK `ON DELETE` (Rekomendasi)

- `sessions.user_id -> users.id`: `ON DELETE CASCADE`
- `season_clubs.season_id -> seasons.id`: `ON DELETE RESTRICT`
- `season_clubs.club_id -> clubs.id`: `ON DELETE RESTRICT`
- `player_club_history.player_id -> players.id`: `ON DELETE RESTRICT`
- `player_club_history.season_id -> seasons.id`: `ON DELETE RESTRICT`
- `player_club_history.club_id -> clubs.id`: `ON DELETE RESTRICT`
- `player_stats.player_id -> players.id`: `ON DELETE RESTRICT`
- `player_stats.season_id -> seasons.id`: `ON DELETE RESTRICT`
- `player_stats.club_id -> clubs.id`: `ON DELETE RESTRICT`
- `player_stats.created_by -> users.id`: `ON DELETE RESTRICT`
- `player_stats.updated_by -> users.id`: `ON DELETE RESTRICT`
- `player_stats_history.player_stats_id -> player_stats.id`: `ON DELETE CASCADE`
- `player_stats_history.changed_by -> users.id`: `ON DELETE RESTRICT`

## 8. Optional Improvement (Production Readiness)

- Tambah `deleted_at` pada `seasons`, `clubs`, `players` untuk soft delete.
- Tambah `version` pada `player_stats` untuk optimistic locking.
- Tambah `change_reason` dan `source` pada `player_stats_history` untuk audit lebih kaya.
- Pertimbangkan constraint anti-overlap assignment player per season (PostgreSQL `EXCLUDE`).

## 9. Migration Checklist

- Buat migration baseline dari skema saat ini.
- Terapkan seluruh `CHECK` constraint inti.
- Terapkan index prioritas untuk endpoint filter/dashboard.
- Tetapkan kebijakan `ON DELETE` di semua FK.
- Jalankan verifikasi data existing sebelum constraint diaktifkan penuh.
- Uji performa p95 setelah index aktif.
