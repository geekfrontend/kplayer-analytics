# Frontend Plan KPlayer Analytics (HeroUI)

Dokumen ini adalah rencana implementasi frontend berdasarkan API aktual di `src/app/api/*` dan referensi [api-reference-postgres.md](./api/api-reference-postgres.md).

## Tujuan

- Membangun aplikasi admin panel untuk operasi harian KPlayer Analytics.
- Fokus pada role `admin` dan `analyst` dengan kontrol akses di level UI.
- Menggunakan HeroUI sebagai fondasi komponen agar konsisten, cepat, dan mudah dirawat.

## Stack Frontend

- Next.js App Router (frontend pages + API calls internal).
- HeroUI untuk komponen visual.
- TypeScript.
- Zod untuk validasi form (sinkron dengan backend).
- React Hook Form untuk manajemen form.
- TanStack Query untuk data fetching, cache, dan invalidation.
- Zustand (opsional) untuk state global ringan (auth user + UI preference).

## Arsitektur Folder (Usulan)

```txt
src/
  app/
    (auth)/
      login/page.tsx
    (protected)/
      layout.tsx
      page.tsx
      users/page.tsx
      seasons/page.tsx
      clubs/page.tsx
      players/page.tsx
      season-clubs/page.tsx
      assignments/page.tsx
      player-stats/page.tsx
      analytics/stats/page.tsx
      analytics/search/page.tsx
  components/
    ui/ # HeroUI components
    forms/
    tables/
    filters/
    charts/
    layout/
  lib/
    api-client.ts
    query-client.ts
    auth.ts
    permissions.ts
  features/
    users/
      schemas.ts
    seasons/
      schemas.ts
    clubs/
      schemas.ts
    players/
      schemas.ts
    season-clubs/
      schemas.ts
    assignments/
      schemas.ts
    player-stats/
      schemas.ts
    analytics/
```

## Mapping Halaman ke Endpoint API

### 1. Auth

- `/login`
- Endpoint: `POST /api/auth/login`
- Aksi tambahan: `GET /api/auth/me` saat bootstrap session, `POST /api/auth/logout` saat sign out.

### 2. Dashboard Summary

- `/`
- Endpoint: `GET /api/dashboard/summary?season_id=...`
- Kebutuhan UI: pemilih season aktif + kartu KPI + top scorer + top assist.

### 3. User Management (`admin`)

- `/users`
- Endpoint: `GET/POST /api/users`, `GET/PATCH/DELETE /api/users/:id`, `PATCH /api/users/:id/reset-password`
- Catatan aksi delete: `DELETE /api/users/:id` adalah soft-delete.
- Kebutuhan UI: tabel users, modal create/edit, dialog reset password, konfirmasi soft-delete.

### 4. Master Data

- `/seasons` -> `GET/POST /api/seasons`, `GET/PATCH/DELETE /api/seasons/:id`
- `/clubs` -> `GET/POST /api/clubs`, `GET/PATCH/DELETE /api/clubs/:id`
- `/players` -> `GET/POST /api/players`, `GET/PATCH/DELETE /api/players/:id`

### 5. Relasi Season-Club

- `/season-clubs`
- Endpoint: `GET/POST /api/season-clubs`, `DELETE /api/season-clubs/:id`

### 6. Assignment Player-Club

- `/assignments`
- Endpoint: `GET/POST /api/player-club-history`, `PATCH/DELETE /api/player-club-history/:id`

### 7. Player Stats + History

- `/player-stats`
- Endpoint: `GET/POST /api/player-stats`, `GET/PATCH /api/player-stats/:id`, `GET /api/player-stats/:id/history`

### 8. Analytics

- `/analytics/stats` -> `GET /api/stats?season_id=&club_id=&player_id=&sort_by=&sort_order=&page=&limit=`
- `/analytics/search` -> `GET /api/search/players?q=&page=&limit=`
- Catatan search: backend saat ini memakai `LIKE` (bukan `ILIKE`), jadi UI tidak boleh mengasumsikan case-insensitive.

## Rencana Komponen HeroUI

### Layout & Navigasi

- `Navbar`, `Avatar`, `Dropdown`, `Button` untuk topbar user menu.
- `Tabs` atau sidebar custom + `Tooltip` untuk navigasi modul.
- `Card` untuk panel dashboard dan ringkasan.

### Tabel Data

- `Table` + `Pagination` untuk list utama.
- `Input` (search), `Select` (filter), `Chip` (status/role), `Dropdown` (aksi baris).
- `Skeleton` untuk loading state, `Spinner` untuk fetch kecil.

### Form & Dialog

- `Modal` untuk create/edit cepat.
- `Input`, `DateInput`/`Input type=date`, `Select`, `Switch`, `Textarea`.
- `FormError` custom yang menampilkan error Zod/backend per field.
- `Popover` atau `Tooltip` untuk helper validation rules.

### Feedback & Error Handling

- `Toast` (via provider) untuk success/error action.
- `Alert`/`Card` fallback untuk error fetch page-level.
- `Snippet` untuk menampilkan request id saat debug (opsional).
- Ambil `request_id` dari header response `x-request-id` (bukan dari body response).

### Analytics UI

- `Card` KPI (`total_players`, top scorer, top assist).
- `Table` ranking stats.
- `Select` season + filter chips + tombol reset filter.

## RBAC di Frontend

- `admin`: semua menu tampil.
- `analyst`: sembunyikan tombol create/edit/delete dan menu manajemen user.
- Proteksi route:
- Cek hasil `GET /api/auth/me` pada layout dashboard.
- Redirect ke `/login` jika unauthorized.
- Gating komponen via helper `can(action, resource, role)`.

## Kontrak Data Frontend

- Buat type response umum:

```ts
type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  statusCode: number;
  data?: T;
  errors?: unknown;
};
```

- Buat mapper untuk `pagination` agar semua tabel pakai util yang sama.
- Normalisasi field integer boolean (`is_active` 1/0) menjadi boolean di UI.
- Simpan metadata `requestId` dari header `x-request-id` di `api-client` agar bisa dipakai untuk debug/support.

## Strategy Query & Mutation

- Query key per modul: `["users", params]`, `["seasons", params]`, dst.
- Query key analytics harus include full query params (`season_id`, `club_id`, `player_id`, `sort_by`, `sort_order`, `page`, `limit`).
- Mutation pattern:
- Create/Update/Delete -> invalidate list + detail terkait.
- Optimistic update opsional; default non-optimistic untuk endpoint yang berpotensi conflict/validasi domain (assignments, player-stats).
- Retry disabled untuk `4xx`, enabled untuk `5xx` dengan backoff ringan.

## Validasi Form (Sinkron Backend)

- Reuse aturan backend:
- Password strong policy.
- UUID validation untuk relasi.
- `shots >= goals`.
- `leave_date >= join_date`.
- `season` format `YYYY/YYYY` dan rentang tanggal valid.
- Field error dari backend (`errors`) dipetakan ke form message.

## Rencana Implementasi Bertahap

### Phase 1 - Foundation

- Setup HeroUI provider, theme, layout shell, auth guard.
- Build halaman login + dashboard summary minimal.

### Phase 2 - Master Data

- Users, seasons, clubs, players (list + CRUD modal).
- Shared table/filter/form component mulai distandarkan.

### Phase 3 - Relasi & Stats

- Season-clubs, assignments, player-stats, stats history drawer/modal.
- Validasi relasi dan conflict handling di UI.

### Phase 4 - Analytics & Hardening

- Halaman stats advanced filter/sort.
- Search players cepat.
- Empty state, loading skeleton, permission polish, UX refinement.

## Definition of Done Frontend

- Semua endpoint utama sudah punya layar dan alur aksi yang sesuai role.
- Tidak ada aksi write yang bisa dieksekusi oleh `analyst` dari UI.
- Form validation selaras backend, error message jelas.
- State loading/error/empty ada di tiap halaman data.
- Query invalidation konsisten setelah mutation.
- Minimal test:
- Unit test untuk helper permissions + mapper.
- Integration test untuk alur login dan 1 alur CRUD utama.
