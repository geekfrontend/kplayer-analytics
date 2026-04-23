# KPlayer Analytics API MVP Series (SQLite + Next.js App Router)

Dokumen ini menjelaskan roadmap pengembangan API berbasis SQLite secara bertahap, mulai dari MVP 1 hingga MVP 4.
Setiap MVP dirancang agar:

- dapat berjalan independen (fresh setup dari nol),
- memiliki skema database yang jelas,
- punya endpoint API spesifik,
- menerapkan authentication, validasi, dan response format konsisten,
- memiliki error handling standar,
- memiliki unit test minimum.

## Standar Teknis Bersama (Berlaku untuk Semua MVP)

### 1. Stack yang Direkomendasikan

- Runtime: Node.js 20+
- Framework API: Next.js App Router (`src/app/api/**/route.ts`)
- Database: SQLite (`better-sqlite3` direkomendasikan)
- Validation: Zod
- Testing: Vitest
- Password hashing: bcrypt
- Token: JWT access token (token aktif disimpan di tabel `sessions`)

### 2. Kondisi Implementasi Saat Ini (Berdasarkan `src/app/api/*`)

Komponen util yang sudah tersedia:

- `constants/status-codes.ts` -> daftar HTTP status code.
- `utils/api-error.ts` -> kelas `ApiError` + helper static (`badRequest`, `unauthorized`, dll).
- `utils/api-response.ts` -> response envelope konsisten via `NextResponse`.
- `utils/route-handler.ts` -> wrapper try/catch global untuk route handler.
- `utils/logger.ts` -> Winston logger (JSON + timestamp + stack).

### 3. Struktur Kode Modular (Template Next.js)

```txt
src/
  app/
    api/
      auth/
        login/route.ts
        logout/route.ts
        me/route.ts
      users/route.ts
      users/[id]/route.ts
      seasons/route.ts
      seasons/[id]/route.ts
      clubs/route.ts
      clubs/[id]/route.ts
      players/route.ts
      players/[id]/route.ts
      player-club-history/route.ts
      player-stats/route.ts
      player-stats/[id]/route.ts
      player-stats/[id]/history/route.ts
      dashboard/summary/route.ts
      constants/
      utils/
  db/
    migrations/
    seeds/
    sqlite.ts
tests/
  unit/
  integration/
```

### 4. Format Response Konsisten (Mengikuti `ApiResponse`)

#### Success

```json
{
  "success": true,
  "message": "Fetched successfully",
  "statusCode": 200,
  "data": {}
}
```

#### Error

```json
{
  "success": false,
  "message": "Input tidak valid",
  "statusCode": 400,
  "errors": [
    {
      "field": "email",
      "issue": "format invalid"
    }
  ]
}
```

### 5. Error Mapping Standar

Gunakan `ApiError` untuk semua error operasional:

- `ApiError.badRequest(...)` -> 400
- `ApiError.unauthorized(...)` -> 401
- `ApiError.forbidden(...)` -> 403
- `ApiError.notFound(...)` -> 404
- `ApiError.conflict(...)` -> 409
- `ApiError.server(...)` -> 500

### 6. Konvensi Endpoint

- Prefix: `/api`
- JSON only (`Content-Type: application/json`)
- Protected route wajib: `Authorization: Bearer <access_token>`
- Semua handler dibungkus `RouteHandler(...)`

---

## Roadmap MVP

| MVP   | Fokus                                      | Dokumen                              |
| ----- | ------------------------------------------ | ------------------------------------ |
| MVP 1 | Fondasi Auth + Health + Struktur API       | `mvp-01-foundation-auth.md`          |
| MVP 2 | User Management + Master Data              | `mvp-02-master-data.md`              |
| MVP 3 | Assignment + Player Stats + History        | `mvp-03-assignment-stats-history.md` |
| MVP 4 | Filtering + Search + Dashboard + Hardening | `mvp-04-analytics-dashboard.md`      |

---

## Cara Pakai Dokumen

1. Mulai dari MVP 1 sampai selesai (DoD terpenuhi).
2. Lanjutkan MVP 2, 3, dan 4 secara berurutan.
3. Jika butuh demo cepat, setiap MVP bisa dijalankan sebagai snapshot mandiri dengan skema pada dokumen masing-masing.
4. Gunakan checklist testing pada tiap MVP sebelum merge.

## Catatan Sinkronisasi

- Dokumen ini sudah diselaraskan dengan struktur existing di `src/app/api/*`.
- Jika util berubah (misalnya format `ApiResponse`), perbarui semua file MVP agar kontrak API tetap konsisten.
