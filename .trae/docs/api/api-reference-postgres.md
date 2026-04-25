# KPlayer Analytics API Reference (PostgreSQL)

Dokumen ini merangkum endpoint yang **sudah terimplementasi** berdasarkan kode di `src/app/api/*`.

## Ringkasan Teknis

- Framework: Next.js App Router (`route.ts`)
- Database: PostgreSQL via Drizzle ORM (`@/db/postgres`)
- Auth: JWT Bearer token + tabel `sessions`
- Validation: Zod
- Test runner: Jest (fokus API)

## Base URL

- Local: `http://localhost:3000/api`

## Header Standar

- `Content-Type: application/json`
- `Authorization: Bearer <access_token>` untuk endpoint yang butuh login

## Format Response

Semua endpoint menggunakan envelope:

```json
{
  "success": true,
  "message": "OK",
  "statusCode": 200,
  "data": {}
}
```

Contoh error:

```json
{
  "success": false,
  "message": "Query tidak valid",
  "statusCode": 400,
  "errors": []
}
```

## Otorisasi Role

- `admin`: boleh akses semua endpoint write (create/update/delete) dan manajemen user.
- `analyst`: read-only pada endpoint yang mensyaratkan login, tidak boleh endpoint admin-only.

## Endpoint

### Root & Health

#### `GET /api`

- Auth: Tidak
- Deskripsi: Info service API.

#### `GET /api/health`

- Auth: Tidak
- Deskripsi: Health check service.

### Authentication

#### `POST /api/auth/login`

- Auth: Tidak
- Body:

```json
{
  "email": "user@example.com",
  "password": "Password123!"
}
```

- Output: `access_token`, `token_type`, `expires_in`, data user.

#### `POST /api/auth/logout`

- Auth: Ya
- Deskripsi: Menghapus session berdasarkan bearer token aktif.

#### `GET /api/auth/me`

- Auth: Ya
- Deskripsi: Mengambil profil user login saat ini.

### Users

#### `GET /api/users`

- Auth: Ya (`admin`)
- Query: `page`, `limit`, `q`, `role`
- Deskripsi: List user (soft-delete tidak ditampilkan).

#### `POST /api/users`

- Auth: Ya (`admin`)
- Body:

```json
{
  "name": "Admin 1",
  "email": "admin@example.com",
  "password": "Password123!",
  "role": "admin"
}
```

#### `GET /api/users/:id`

- Auth: Ya (`admin`)
- Deskripsi: Detail user aktif.

#### `PATCH /api/users/:id`

- Auth: Ya (`admin`)
- Body opsional: `name`, `email`, `role` (minimal 1 field).

#### `DELETE /api/users/:id`

- Auth: Ya (`admin`)
- Deskripsi: Soft-delete user + hapus seluruh session user.
- Catatan: Admin tidak bisa menghapus dirinya sendiri.

#### `PATCH /api/users/:id/reset-password`

- Auth: Ya (`admin`)
- Body:

```json
{
  "new_password": "NewPassword123!"
}
```

- Deskripsi: Reset password user + revoke semua session user.

### Seasons

#### `GET /api/seasons`

- Auth: Ya
- Query: `page`, `limit`, `q`

#### `POST /api/seasons`

- Auth: Ya (`admin`)
- Body:

```json
{
  "name": "2025/2026",
  "start_date": "2025-07-01",
  "end_date": "2026-05-31",
  "is_active": true
}
```

#### `GET /api/seasons/:id`

- Auth: Ya

#### `PATCH /api/seasons/:id`

- Auth: Ya (`admin`)
- Body opsional: `name`, `start_date`, `end_date`, `is_active`.

#### `DELETE /api/seasons/:id`

- Auth: Ya (`admin`)
- Deskripsi: Hard delete season.

### Clubs

#### `GET /api/clubs`

- Auth: Ya
- Query: `page`, `limit`, `q`

#### `POST /api/clubs`

- Auth: Ya (`admin`)
- Body:

```json
{
  "name": "FC Example",
  "country": "Indonesia"
}
```

#### `GET /api/clubs/:id`

- Auth: Ya

#### `PATCH /api/clubs/:id`

- Auth: Ya (`admin`)
- Body opsional: `name`, `country` (minimal 1 field).

#### `DELETE /api/clubs/:id`

- Auth: Ya (`admin`)
- Deskripsi: Hard delete club.

### Players

#### `GET /api/players`

- Auth: Ya
- Query: `page`, `limit`, `q`

#### `POST /api/players`

- Auth: Ya (`admin`)
- Body:

```json
{
  "full_name": "John Doe",
  "date_of_birth": "2000-01-01",
  "nationality": "Indonesia",
  "primary_position": "Forward"
}
```

#### `GET /api/players/:id`

- Auth: Ya

#### `PATCH /api/players/:id`

- Auth: Ya (`admin`)
- Body opsional: `full_name`, `date_of_birth`, `nationality`, `primary_position`.

#### `DELETE /api/players/:id`

- Auth: Ya (`admin`)
- Deskripsi: Hard delete player.

### Season Clubs (Relasi season-club)

#### `GET /api/season-clubs`

- Auth: Ya
- Query: `season_id`, `club_id`, `page`, `limit`

#### `POST /api/season-clubs`

- Auth: Ya (`admin`)
- Body:

```json
{
  "season_id": "uuid",
  "club_id": "uuid"
}
```

- Validasi: `season` dan `club` harus valid.

#### `DELETE /api/season-clubs/:id`

- Auth: Ya (`admin`)
- Deskripsi: Hapus relasi season-club.

### Player Club History (Assignment)

#### `GET /api/player-club-history`

- Auth: Ya
- Query: `player_id`, `season_id`, `club_id`, `is_active`, `page`, `limit`

#### `POST /api/player-club-history`

- Auth: Ya (`admin`)
- Body:

```json
{
  "player_id": "uuid",
  "season_id": "uuid",
  "club_id": "uuid",
  "join_date": "2025-07-01",
  "leave_date": "2026-05-31",
  "is_active": true
}
```

- Validasi:
- Player, season, club wajib ada.
- Pasangan season-club wajib ada di `season-clubs`.
- Jika `is_active=true`, tidak boleh ada assignment aktif lain untuk player di season yang sama.

#### `PATCH /api/player-club-history/:id`

- Auth: Ya (`admin`)
- Body opsional: `player_id`, `season_id`, `club_id`, `join_date`, `leave_date|null`, `is_active`.
- Validasi: sama seperti create + anti konflik assignment aktif.

#### `DELETE /api/player-club-history/:id`

- Auth: Ya (`admin`)
- Deskripsi: Hapus assignment.

### Player Stats

#### `GET /api/player-stats`

- Auth: Ya
- Query: `player_id`, `season_id`, `club_id`, `page`, `limit`

#### `POST /api/player-stats`

- Auth: Ya (`admin`)
- Body:

```json
{
  "player_id": "uuid",
  "season_id": "uuid",
  "club_id": "uuid",
  "minutes_played": 900,
  "goals": 10,
  "assists": 4,
  "shots": 30
}
```

- Validasi:
- `shots >= goals`
- Relasi player/season/club valid
- Harus punya assignment valid di `player-club-history`

#### `GET /api/player-stats/:id`

- Auth: Ya
- Deskripsi: Detail stats per record.

#### `PATCH /api/player-stats/:id`

- Auth: Ya (`admin`)
- Body opsional: `minutes_played`, `goals`, `assists`, `shots`.
- Efek samping:
- Update data stats.
- Menulis audit trail ke `player_stats_history` (`before_payload`, `after_payload`, `changed_by`, `changed_at`) dalam transaksi.

#### `GET /api/player-stats/:id/history`

- Auth: Ya
- Query: `page`, `limit`
- Deskripsi: Riwayat perubahan stats (payload JSON sebelum/sesudah).

### Analytics

#### `GET /api/stats`

- Auth: Ya
- Query:
- Filter: `season_id`, `club_id`, `player_id`
- Sort: `sort_by` (`updated_at|goals|assists|minutes_played`), `sort_order` (`asc|desc`)
- Pagination: `page`, `limit`

#### `GET /api/search/players`

- Auth: Ya
- Query: `q` (wajib), `page`, `limit`
- Deskripsi: Search pemain berdasarkan `full_name` (partial match).

#### `GET /api/dashboard/summary`

- Auth: Ya
- Query: `season_id` (wajib)
- Output:
- `total_players`: jumlah distinct player pada season
- `top_scorer`: pemain dengan agregat goal tertinggi
- `top_assist`: pemain dengan agregat assist tertinggi

## Catatan Implementasi Penting

- Kode sudah memakai `@/db/postgres`, tetapi masih ada helper bernama `getSqliteErrorCode` di beberapa route. Ini hanya nama fungsi; secara logika dipakai untuk membaca `error.code`.
- `is_active` di beberapa tabel masih disimpan sebagai angka `1/0`.
- Mayoritas endpoint write mewajibkan role `admin`.
