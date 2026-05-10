# Frontend Plan CRUD KPlayer Analytics (shadcn/ui)

## 1. Tujuan Dokumen

Dokumen ini menjadi rencana implementasi frontend CRUD yang selaras dengan:

- API aktual di `src/app/api/*`
- PRD (`.trae/docs/PRD.md`)
- design system terbaru berbasis `shadcn/ui` + semantic token

Target utamanya adalah membangun UI CRUD yang konsisten, role-aware (`admin`/`analyst`), dan siap dikembangkan ke modul analytics.

---

## 2. Prinsip Implementasi

1. Gunakan komponen `shadcn/ui` terlebih dulu sebelum custom component.
2. Prioritaskan Bahasa Indonesia untuk semua teks UI (judul, label, helper, validasi, pesan error/sukses) dan dokumentasi internal; gunakan bahasa lain hanya jika ada kebutuhan teknis.
3. Semua warna harus menggunakan semantic token global utama (`--background`, `--foreground`, `--primary`, `--muted`, `--muted-foreground`, `--border`, `--ring`, `--accent`).
4. Tone visual wajib warm, calm, minimal, dan productivity-focused dengan depth halus (`1px` border, shadow opacity <= `0.05`).
5. Gunakan lebar konten konsisten sekitar `1200px` dan ritme section `--background`/`--muted`.
6. Typography utama menggunakan `Poppins` (`--font-sans`, `--font-heading`) bobot `400/500/600/700`.
7. Accessibility wajib: state hover/active/focus/disabled jelas dan focus ring `2px` via `--ring`.
8. Semua form ditargetkan migrasi ke `TanStack Form` + schema validator (Zod) untuk validasi inline dan type-safety.
9. Semua list pakai pola tabel standar: filter, pagination, loading, empty state, error state.
10. Semua aksi write (create/edit/delete) harus menghormati role akses dari backend.

---

## 3. Scope CRUD Frontend

### 3.1 Modul yang dibuat

- Authentication: login, logout, bootstrap session.
- Users (admin only): list/create/edit/delete/reset password.
- Seasons: list/create/edit/delete.
- Clubs: list/create/edit/delete.
- Players: list/create/edit/delete.
- Season Clubs: list/create/delete relasi season-club.
- Player Club History: list/create/edit/delete assignment.
- Player Stats: list/create/detail/edit.
- Player Stats History: read-only per stats.

### 3.2 Modul read/analytics pendukung

- Search players (`/api/search/players`).
- Stats explorer (`/api/stats`).
- Dashboard summary (`/api/dashboard/summary`).

---

## 4. Arsitektur Frontend yang Disarankan

## 4.1 Struktur folder

```txt
src/
  app/
    (auth)/
      login/page.tsx
    (protected)/
      layout.tsx
      dashboard/page.tsx
      users/page.tsx
      seasons/page.tsx
      clubs/page.tsx
      players/page.tsx
      season-clubs/page.tsx
      assignments/page.tsx
      player-stats/page.tsx
      player-stats/[id]/history/page.tsx
  components/
    ui/...
    app/
      data-table.tsx
      pagination.tsx
      confirm-dialog.tsx
      role-guard.tsx
      forms/
        user-form.tsx
        season-form.tsx
        club-form.tsx
        player-form.tsx
        season-club-form.tsx
        assignment-form.tsx
        player-stats-form.tsx
  lib/
    api-client.ts
    auth.ts
    query.ts
    table.ts
```

## 4.2 State management & server state

- Minimal awal: `useState` + `useEffect` per halaman.
- Prioritas implementasi: `@tanstack/react-query` untuk cache, refetch, invalidation, optimistic UX.

## 4.3 HTTP layer

- Semua request lewat wrapper `lib/api-client.ts`.
- Standardisasi:
  - inject bearer token
  - parse envelope `ApiResponse`
  - lempar error message ramah user

## 4.4 Plan TanStack Form

- Library: `@tanstack/react-form` + `zod` adapter.
- Target awal: form `seasons`, `clubs`, `players`, `assignments`, `player-stats`.
- Pola implementasi:
  - `formOptions` per modul di `src/components/app/forms/*`
  - validasi field-level (`onChange`/`onBlur`) + form-level untuk rule lintas field
  - mapping error backend ke error form agar pesan server tetap tampil konsisten
- Rule UX:
  - submit button subscribe ke `canSubmit` + `isSubmitting`
  - tampilkan error setelah field touched
  - reset form saat modal ditutup/sukses submit

## 4.5 Plan TanStack Query

- Library: `@tanstack/react-query`.
- Struktur query key factory di `src/lib/query.ts`:
  - `users.list(params)`, `users.detail(id)`
  - `seasons.list(params)`, `seasons.detail(id)` dan seterusnya
- Pattern mutasi:
  - create/update/delete menggunakan `useMutation`
  - `onSuccess` wajib invalidasi query list/detail terkait
  - gunakan optimistic update hanya untuk aksi ringan (toggle/status/edit singkat)
- Konfigurasi default:
  - `staleTime` list data master: 30-60 detik
  - retry untuk error 5xx, tidak retry untuk 4xx validasi
  - global handler untuk unauthorized -> paksa logout/redirect login

## 4.6 Plan TanStack Table

- Library: `@tanstack/react-table`.
- Komponen utama:
  - `components/app/data-table.tsx` (generic table shell)
  - `components/app/data-table-toolbar.tsx` (search/filter)
  - `components/app/data-table-pagination.tsx`
- Fitur minimum per modul CRUD:
  - sorting kolom, server-side pagination, kolom aksi
  - column visibility untuk tabel kompleks (`player-stats`, `assignments`)
- Integrasi backend:
  - state table (`pageIndex`, `pageSize`, `sorting`) diterjemahkan ke query params API
  - data fetch disinkronkan via TanStack Query agar perpindahan page/filter responsif

---

## 5. Desain UI CRUD (Pola Umum)

Setiap modul CRUD mengikuti pola halaman yang sama:

1. Header halaman: judul + deskripsi + tombol `Tambah` (hanya admin).
2. Filter bar: search/filter spesifik endpoint.
3. Tabel data:
   - kolom utama
   - aksi row (`Detail`, `Edit`, `Delete`) sesuai role
4. Pagination footer.
5. Modal/dialog:
   - form create/edit
   - confirm delete
6. Toast/alert untuk feedback sukses/gagal.

Komponen shadcn yang dipakai:

- `Card`, `Button`, `Input`, `Label`, `Textarea`
- `Select`, `DropdownMenu`, `Dialog`, `AlertDialog`
- `Table`, `Badge`, `Tabs`, `Skeleton`

---

## 6. Mapping Halaman ke Endpoint

## 6.1 Users (`/users`)

- GET `/api/users`
- POST `/api/users`
- PATCH `/api/users/:id`
- DELETE `/api/users/:id`
- PATCH `/api/users/:id/reset-password`

UI penting:

- filter `q`, `role`
- action reset password di row menu
- analyst: halaman tidak tampil (redirect/forbidden)

## 6.2 Seasons (`/seasons`)

- GET `/api/seasons`
- POST `/api/seasons`
- PATCH `/api/seasons/:id`
- DELETE `/api/seasons/:id`

UI penting:

- validasi format `YYYY/YYYY`
- date picker `start_date`/`end_date`
- toggle `is_active`

## 6.3 Clubs (`/clubs`)

- GET `/api/clubs`
- POST `/api/clubs`
- PATCH `/api/clubs/:id`
- DELETE `/api/clubs/:id`

UI penting:

- kolom `name`, `country`
- search cepat berdasarkan nama

## 6.4 Players (`/players`)

- GET `/api/players`
- POST `/api/players`
- PATCH `/api/players/:id`
- DELETE `/api/players/:id`

UI penting:

- validasi tanggal lahir tidak masa depan
- kolom posisi utama, nasionalitas

## 6.5 Season Clubs (`/season-clubs`)

- GET `/api/season-clubs`
- POST `/api/season-clubs`
- DELETE `/api/season-clubs/:id`

UI penting:

- create via 2 dropdown: season + club
- tampilkan list relasi dengan filter season/club

## 6.6 Assignments (`/assignments`)

- GET `/api/player-club-history`
- POST `/api/player-club-history`
- PATCH `/api/player-club-history/:id`
- DELETE `/api/player-club-history/:id`

UI penting:

- dropdown player, season, club
- `join_date`, `leave_date`, `is_active`
- warning konflik assignment aktif

## 6.7 Player Stats (`/player-stats`)

- GET `/api/player-stats`
- POST `/api/player-stats`
- GET `/api/player-stats/:id`
- PATCH `/api/player-stats/:id`
- GET `/api/player-stats/:id/history`

UI penting:

- filter player/season/club
- validasi `shots >= goals`
- tombol lihat history perubahan

---

## 7. Role & Route Guard

1. Global protected layout cek session (`/api/auth/me`).
2. Simpan role user pada state layout/context ringan.
3. Navigasi adaptif:
   - `admin`: semua menu CRUD + analytics
   - `analyst`: menu read-only (dashboard, stats, search, history)
4. Role guard di level halaman untuk mencegah akses langsung via URL.

---

## 8. Rencana Implementasi Bertahap

Status singkat implementasi saat ini:

- `Done`: bootstrap auth login/logout, protected layout dasar, role-aware nav admin.
- `Done`: perapihan visual awal untuk halaman `login`, `protected layout`, dan `seasons` berbasis token semantic.
- `In Progress`: standardisasi pola CRUD lintas modul (`clubs`, `players`, dst) agar konsisten dengan shell terbaru.
- `Planned`: migrasi form ke TanStack Form dan standardisasi data table reusable.

## Phase 1 - Foundation UI & Auth

- rapikan `protected layout`, navbar, role-aware menu
- standard komponen global (`DataTable`, `Pagination`, `ConfirmDialog`)
- setup `QueryClientProvider` + query key factory dasar
- finalisasi helper API client + error handler

Deliverable:

- login/logout stabil
- shell aplikasi konsisten
- catatan progres: sudah tercapai untuk baseline, lanjut polishing konsistensi lintas halaman

## Phase 2 - Master Data CRUD

- halaman `seasons`, `clubs`, `players`
- reusable form modal + validasi berbasis TanStack Form
- pagination + search + toast

Deliverable:

- admin bisa CRUD 3 entitas master
- analyst read-only
- catatan progres: `seasons` sudah aktif dengan pagination/search/create; `clubs` dan `players` tahap penyesuaian pola UI/UX

## Phase 3 - Relasi Domain CRUD

- halaman `season-clubs`
- halaman `assignments` (player-club-history)
- standardisasi tabel via TanStack Table + server-side state

Deliverable:

- relasi season-club dan assignment player berjalan end-to-end

## Phase 4 - Stats + History + Analytics

- halaman `player-stats` + edit form
- halaman history per stats
- dashboard summary + stats explorer + player search
- optimasi query invalidation/refetch dan UX loading lintas halaman

Deliverable:

- flow input stats sampai audit history lengkap
- insight dashboard dasar tersedia

---

## 9. Checklist Teknis per Halaman CRUD

- loading state saat fetch
- disabled state saat submit
- empty state saat data kosong
- error state saat API gagal
- validasi form client-side dan server error mapping
- konfirmasi delete (`AlertDialog`)
- query param sinkron (`page`, `limit`, `q`, filter)

---

## 10. Testing Frontend (Minimum)

1. Login sukses/gagal.
2. Guard route saat token tidak ada/expired.
3. Admin bisa create/edit/delete pada modul master data.
4. Analyst tidak melihat tombol aksi write.
5. Form stats menolak `shots < goals`.
6. Halaman history menampilkan perubahan terbaru lebih dulu.

---

## 11. Risiko & Mitigasi

- Risiko: duplikasi logic form antar halaman.  
  Mitigasi: gunakan reusable `FormDialog` + skema zod per modul.

- Risiko: drift antara aturan backend dan validasi frontend.  
  Mitigasi: mirror rule utama dari endpoint + tampilkan pesan backend apa adanya.

- Risiko: UX lambat pada list data besar.  
  Mitigasi: server-side pagination + debounce search + cache query.

---

## 12. Definition of Done Frontend CRUD

- Semua halaman CRUD utama tersedia dan terkoneksi endpoint.
- Role-based UI dan guard route berjalan konsisten.
- Komponen mengikuti design system shadcn + semantic token.
- Tidak ada error lint/typecheck.
- Alur end-to-end berikut berjalan:
  - login -> master data -> assignment -> stats -> history -> dashboard.
