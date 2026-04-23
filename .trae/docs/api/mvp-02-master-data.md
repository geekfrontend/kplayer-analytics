# MVP 2 - Master Data

## 1. Tujuan MVP

Menambahkan modul data inti setelah auth stabil:

- user management oleh admin,
- CRUD `seasons`
- CRUD `clubs`
- CRUD `players`
- assignment `club` ke `season` (`season_clubs`)

Semua endpoint tetap menggunakan auth, validasi Zod, dan response envelope standar via `ApiResponse`.

## 2. Fitur

- Admin dapat create/update/deactivate user.
- Admin dapat create/update/delete data master.
- Analyst hanya read data master.
- Validasi business rule season.
- Cegah duplikasi relasi `season_id + club_id`.

## 3. Skema Database (SQLite Snapshot)

```sql
PRAGMA foreign_keys = ON;

-- MVP 1 tables: users, sessions
-- + tabel baru:

CREATE TABLE seasons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE clubs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  country TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE players (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  date_of_birth TEXT NOT NULL,
  nationality TEXT,
  primary_position TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE season_clubs (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  club_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE RESTRICT,
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE RESTRICT,
  UNIQUE (season_id, club_id)
);
```

## 4. Endpoint API

### Users (Admin Management)

- `GET /api/users` (admin)
- `POST /api/users` (admin)
- `GET /api/users/:id` (admin)
- `PATCH /api/users/:id` (admin)
- `PATCH /api/users/:id/reset-password` (admin)

### Seasons

- `GET /api/seasons`
- `POST /api/seasons` (admin)
- `GET /api/seasons/:id`
- `PATCH /api/seasons/:id` (admin)
- `DELETE /api/seasons/:id` (admin)

### Clubs

- `GET /api/clubs`
- `POST /api/clubs` (admin)
- `GET /api/clubs/:id`
- `PATCH /api/clubs/:id` (admin)
- `DELETE /api/clubs/:id` (admin)

### Players

- `GET /api/players`
- `POST /api/players` (admin)
- `GET /api/players/:id`
- `PATCH /api/players/:id` (admin)
- `DELETE /api/players/:id` (admin)

### Season Clubs

- `GET /api/season-clubs?season_id=<id>`
- `POST /api/season-clubs` (admin)
- `DELETE /api/season-clubs/:id` (admin)

Catatan implementasi route:

- Gunakan folder `src/app/api/<resource>/route.ts` dan `src/app/api/<resource>/[id]/route.ts`.
- Bungkus handler dengan `RouteHandler`.
- Gunakan `ApiError.forbidden(...)` untuk blok role analyst di endpoint write.

## 5. Validasi Data Inti

- `users.email` wajib unik.
- `users.role` hanya `admin` atau `analyst`.
- Password saat create/reset wajib strong password policy.
- `seasons.name` wajib format `YYYY/YYYY`.
- Tahun kedua harus tahun pertama + 1.
- `start_date < end_date`.
- `players.date_of_birth` tidak boleh tanggal masa depan.
- `season_clubs` tidak boleh duplikat.

## 6. Error Handling

- Rule gagal validasi -> `400 VALIDATION_ERROR`
- Data tidak ditemukan -> `404 NOT_FOUND`
- Konflik unique -> `409 CONFLICT`
- Akses role tidak sesuai -> `403 FORBIDDEN`
- Semua error operasional dilempar dengan `ApiError`.

## 7. Unit Test Minimum

- Create user sukses oleh admin.
- Create user gagal jika email duplikat.
- Analyst tidak bisa akses endpoint `/api/users`.
- Reset password user sukses.
- CRUD season sukses.
- Create season gagal jika format nama salah.
- Create season_club gagal jika duplikat.
- Analyst gagal akses endpoint write.
- List endpoint mendukung pagination (`page`, `limit`).

## 8. Definition of Done (DoD)

- Semua CRUD master data berjalan.
- User management admin berjalan.
- RBAC admin/analyst konsisten.
- Test untuk modul `users`, `seasons`, `clubs`, `players`, `season_clubs` lulus.
