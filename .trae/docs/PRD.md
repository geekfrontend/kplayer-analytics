# PRODUCT REQUIREMENTS DOCUMENT (PRD)

## 1. Informasi Dokumen

| Item          | Nilai                               |
| ------------- | ----------------------------------- |
| Product Name  | KPlayer Analytics                   |
| Tipe Produk   | Web Application (Fullstack Next.js) |
| Versi Dokumen | 1.2 (Aligned with ERD)              |
| Status        | Draft Siap Implementasi             |
| Owner         | Product Team                        |
| Last Updated  | 2026-04-23                          |

---

## 2. Ringkasan Produk

KPlayer Analytics adalah aplikasi web untuk mengelola data pemain sepak bola lintas musim dan klub, termasuk pencatatan statistik performa, histori perubahan data, dan insight dashboard dasar.

Masalah utama:

- Evaluasi pemain masih subjektif karena data historis tidak rapi.
- Data performa tersebar di banyak sumber.
- Perbandingan performa lintas musim dan lintas klub sulit dilakukan.

Nilai utama:

- Data pemain tersentralisasi dan konsisten.
- Perubahan statistik tidak overwrite dan selalu memiliki jejak historis.
- Analisis awal lebih cepat melalui filter dan dashboard.

---

## 3. Tujuan Produk

### 3.1 Tujuan Utama

- Menyediakan sistem pencatatan performa pemain berbasis data.
- Mengurangi subjektivitas dalam evaluasi pemain.
- Menyediakan histori performa pemain lintas musim dan klub.

### 3.2 Tujuan Sekunder

- Menjadi fondasi untuk analisis lanjutan (misalnya clustering/K-Means).
- Mendukung visualisasi dan dashboard performa.
- Menjadi single source of truth data pemain internal.

### 3.3 KPI Keberhasilan

| KPI                                        | Target     |
| ------------------------------------------ | ---------- |
| Kelengkapan data statistik per musim aktif | >= 95%     |
| Waktu pencarian data pemain (query umum)   | <= 3 detik |
| Perubahan statistik tercatat ke history    | 100%       |
| Pengurangan input duplikat                 | >= 80%     |

---

## 4. Ruang Lingkup

### 4.1 In Scope (MVP)

- Authentication dan role-based access (`admin`, `analyst`).
- CRUD `season`, `club`, dan `player`.
- Assignment club ke season.
- Assignment player ke club per season.
- Input dan update statistik pemain.
- Penyimpanan histori statistik otomatis.
- Filtering, pencarian, dan dashboard ringkasan.

### 4.2 Out of Scope (Fase Lanjutan)

- Integrasi API data eksternal (Opta/StatsBomb/FBref).
- Prediksi performa berbasis machine learning.
- Mobile native app.
- Multi-language UI.
- Notifikasi real-time lintas channel.

---

## 5. Pengguna dan Hak Akses

### 5.1 Persona

| Role    | Tujuan                                                      | Batasan                               |
| ------- | ----------------------------------------------------------- | ------------------------------------- |
| Admin   | Kelola data master, assignment, statistik, dan koreksi data | Tidak ada batasan di modul internal   |
| Analyst | Konsumsi data, filter, analisis, dashboard                  | Tidak bisa ubah data master/statistik |

### 5.2 Matriks Akses

| Modul               | Admin                 | Analyst      |
| ------------------- | --------------------- | ------------ |
| Auth                | Login/Logout/Register | Login/Logout |
| Season              | CRUD                  | Read         |
| Club                | CRUD                  | Read         |
| Player              | CRUD                  | Read         |
| Player Club History | CRUD                  | Read         |
| Player Statistics   | CRUD                  | Read         |
| Stats History       | Read                  | Read         |
| Dashboard           | Read                  | Read         |

---

## 6. User Journey Utama

1. User login ke sistem.
2. Admin menyiapkan season.
3. Admin membuat club dan mengaitkan ke season.
4. Admin membuat data player.
5. Admin assign player ke club pada season tertentu.
6. Admin input atau update statistik pemain.
7. Sistem menyimpan histori perubahan statistik.
8. User melakukan filter/search dan membaca dashboard.

---

## 7. Functional Requirements

| ID    | Requirement            | Deskripsi                                | Acceptance Criteria                                           |
| ----- | ---------------------- | ---------------------------------------- | ------------------------------------------------------------- |
| FR-01 | Register & Login       | User dapat registrasi, login, logout     | Login valid menghasilkan sesi aktif; kredensial salah ditolak |
| FR-02 | RBAC                   | Role `admin` dan `analyst`               | Endpoint/halaman terproteksi sesuai role                      |
| FR-03 | CRUD Season            | Admin mengelola season                   | Season unik per label `YYYY/YYYY`                             |
| FR-04 | CRUD Club              | Admin mengelola club                     | Nama club unik                                                |
| FR-05 | Club-Season Assignment | Admin assign club ke season              | Tidak boleh duplikat pasangan `season_id + club_id`           |
| FR-06 | CRUD Player            | Admin mengelola data pemain              | Data wajib tervalidasi                                        |
| FR-07 | Player-Club History    | Admin assign player ke club per season   | Menyimpan `join_date` dan `leave_date` opsional               |
| FR-08 | Input Stats            | Admin input statistik pemain             | Hanya player valid pada scope season/club                     |
| FR-09 | Update Stats + History | Update statistik tidak boleh tanpa jejak | Setiap update membuat record `player_stats_history`           |
| FR-10 | Filtering/Search       | Filter season/club/player + search nama  | Hasil sesuai kombinasi filter dan pagination                  |
| FR-11 | Dashboard Summary      | Statistik agregasi dasar                 | Menampilkan total pemain, top scorer, top assist              |
| FR-12 | Audit Metadata         | Simpan metadata perubahan                | Tersedia `created_by`, `updated_by`, `changed_by`, timestamp  |

---

## 8. Aturan Bisnis dan Validasi

### 8.1 Season

- Format season wajib `YYYY/YYYY`.
- Tahun kedua harus tahun pertama + 1.
- Satu season memiliki label unik.
- `start_date` harus lebih kecil dari `end_date`.

### 8.2 Player

- Nama pemain wajib diisi.
- Tanggal lahir tidak boleh di masa depan.
- Posisi pemain harus berasal dari daftar posisi yang disetujui.

### 8.3 Assignment Player-Club

- Player tidak boleh punya dua assignment aktif dalam season yang sama.
- `leave_date` tidak boleh lebih kecil dari `join_date`.
- Assignment harus merujuk ke pasangan season-club yang valid.

### 8.4 Statistik

- `minutes_played >= 0`
- `goals >= 0`
- `assists >= 0`
- `shots >= goals`
- Unik per `player_id + season_id + club_id`.

### 8.5 Histori Statistik

- Simpan snapshot sebelum dan sesudah perubahan.
- Histori tidak dapat diubah dari UI standar.
- Histori menyimpan user pengubah dan waktu perubahan.

---

## 9. Non-Functional Requirements

### 9.1 Performance

- API response time p95 <= 500 ms untuk query normal.
- API response time p95 <= 1.5 s untuk query dashboard agregasi.
- Indexing wajib pada kolom filter utama (`season_id`, `club_id`, `player_id`, `created_at`).

### 9.2 Security

- Password hashing menggunakan bcrypt.
- Session-based auth atau JWT dengan expiry.
- Enforce authorization di server side untuk semua endpoint.
- Validasi input dan sanitasi untuk mencegah injection.
- Audit log untuk aksi create/update/delete penting.

### 9.3 Reliability

- Error response standar: `code`, `message`, `details`.
- Backup database berkala.
- Soft delete untuk entitas master direkomendasikan.

### 9.4 Usability

- UI sederhana, konsisten, dan mudah dipelajari.
- Empty-state dan error-state informatif.
- Form memiliki validasi inline.

### 9.5 Scalability

- Mendukung multi-season.
- Pagination wajib pada list data besar.
- Query dashboard siap untuk optimasi cache.

---

## 10. Data Model (Aligned with ERD)

### 10.1 Entitas Utama

`users`, `sessions`, `seasons`, `clubs`, `season_clubs`, `players`, `player_club_history`, `player_stats`, `player_stats_history`

### 10.2 Struktur Tabel Ringkas

#### `users`

| Kolom         | Tipe      | Constraint                    |
| ------------- | --------- | ----------------------------- |
| id            | uuid      | PK                            |
| name          | text      | NOT NULL                      |
| email         | text      | NOT NULL, UNIQUE              |
| password_hash | text      | NOT NULL                      |
| role          | enum      | NOT NULL (`admin`, `analyst`) |
| created_at    | timestamp | NOT NULL                      |
| updated_at    | timestamp | NOT NULL                      |

#### `sessions`

| Kolom      | Tipe      | Constraint                 |
| ---------- | --------- | -------------------------- |
| id         | uuid      | PK                         |
| user_id    | uuid      | FK -> `users.id`, NOT NULL |
| token      | text      | NOT NULL, UNIQUE           |
| expires_at | timestamp | NOT NULL                   |
| created_at | timestamp | NOT NULL                   |

#### `seasons`

| Kolom      | Tipe      | Constraint       |
| ---------- | --------- | ---------------- |
| id         | uuid      | PK               |
| name       | text      | NOT NULL, UNIQUE |
| start_date | date      | NOT NULL         |
| end_date   | date      | NOT NULL         |
| is_active  | boolean   | NOT NULL         |
| created_at | timestamp | NOT NULL         |
| updated_at | timestamp | NOT NULL         |

#### `clubs`

| Kolom      | Tipe      | Constraint       |
| ---------- | --------- | ---------------- |
| id         | uuid      | PK               |
| name       | text      | NOT NULL, UNIQUE |
| country    | text      | NULLABLE         |
| created_at | timestamp | NOT NULL         |
| updated_at | timestamp | NOT NULL         |

#### `season_clubs`

| Kolom      | Tipe      | Constraint                   |
| ---------- | --------- | ---------------------------- |
| id         | uuid      | PK                           |
| season_id  | uuid      | FK -> `seasons.id`, NOT NULL |
| club_id    | uuid      | FK -> `clubs.id`, NOT NULL   |
| created_at | timestamp | NOT NULL                     |

Constraint tambahan:

- UNIQUE (`season_id`, `club_id`)

#### `players`

| Kolom            | Tipe      | Constraint |
| ---------------- | --------- | ---------- |
| id               | uuid      | PK         |
| full_name        | text      | NOT NULL   |
| date_of_birth    | date      | NOT NULL   |
| nationality      | text      | NULLABLE   |
| primary_position | text      | NOT NULL   |
| created_at       | timestamp | NOT NULL   |
| updated_at       | timestamp | NOT NULL   |

#### `player_club_history`

| Kolom      | Tipe      | Constraint                   |
| ---------- | --------- | ---------------------------- |
| id         | uuid      | PK                           |
| player_id  | uuid      | FK -> `players.id`, NOT NULL |
| season_id  | uuid      | FK -> `seasons.id`, NOT NULL |
| club_id    | uuid      | FK -> `clubs.id`, NOT NULL   |
| join_date  | date      | NOT NULL                     |
| leave_date | date      | NULLABLE                     |
| is_active  | boolean   | NOT NULL                     |
| created_at | timestamp | NOT NULL                     |
| updated_at | timestamp | NOT NULL                     |

#### `player_stats`

| Kolom          | Tipe      | Constraint                   |
| -------------- | --------- | ---------------------------- |
| id             | uuid      | PK                           |
| player_id      | uuid      | FK -> `players.id`, NOT NULL |
| season_id      | uuid      | FK -> `seasons.id`, NOT NULL |
| club_id        | uuid      | FK -> `clubs.id`, NOT NULL   |
| minutes_played | int       | NOT NULL, CHECK `>= 0`       |
| goals          | int       | NOT NULL, CHECK `>= 0`       |
| assists        | int       | NOT NULL, CHECK `>= 0`       |
| shots          | int       | NOT NULL, CHECK `>= goals`   |
| created_at     | timestamp | NOT NULL                     |
| updated_at     | timestamp | NOT NULL                     |
| created_by     | uuid      | FK -> `users.id`, NOT NULL   |
| updated_by     | uuid      | FK -> `users.id`, NOT NULL   |

Constraint tambahan:

- UNIQUE (`player_id`, `season_id`, `club_id`)

#### `player_stats_history`

| Kolom           | Tipe      | Constraint                        |
| --------------- | --------- | --------------------------------- |
| id              | uuid      | PK                                |
| player_stats_id | uuid      | FK -> `player_stats.id`, NOT NULL |
| before_payload  | jsonb     | NOT NULL                          |
| after_payload   | jsonb     | NOT NULL                          |
| changed_by      | uuid      | FK -> `users.id`, NOT NULL        |
| changed_at      | timestamp | NOT NULL                          |

### 10.3 Relasi Data

- `users` 1..N `sessions`
- `seasons` N..N `clubs` via `season_clubs`
- `players` 1..N `player_club_history`
- `seasons` 1..N `player_club_history`
- `clubs` 1..N `player_club_history`
- `players` 1..N `player_stats`
- `seasons` 1..N `player_stats`
- `clubs` 1..N `player_stats`
- `users` 1..N `player_stats` (via `created_by`, `updated_by`)
- `player_stats` 1..N `player_stats_history`
- `users` 1..N `player_stats_history` (via `changed_by`)

---

## 11. Kebutuhan API (High-Level)

### 11.1 Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### 11.2 Master Data

- `GET/POST /api/seasons`
- `GET/PATCH/DELETE /api/seasons/:id`
- `GET/POST /api/clubs`
- `GET/PATCH/DELETE /api/clubs/:id`
- `GET/POST /api/players`
- `GET/PATCH/DELETE /api/players/:id`

### 11.3 Relasi dan Statistik

- `GET/POST /api/season-clubs`
- `GET/POST /api/player-club-history`
- `GET/POST /api/player-stats`
- `GET/PATCH /api/player-stats/:id`
- `GET /api/player-stats/:id/history`

### 11.4 Query dan Dashboard

- `GET /api/search/players?q=...`
- `GET /api/stats?season_id=...&club_id=...&player_id=...`
- `GET /api/dashboard/summary?season_id=...`

---

## 12. Kebutuhan UI/UX

### 12.1 Navigasi

- Sidebar: Dashboard, Seasons, Clubs, Players, Assignments, Stats, History.

### 12.2 Standar Tabel

- Sorting.
- Pagination.
- Filter.
- Aksi per row (detail, edit, delete) sesuai role.

### 12.3 Standar Form

- Validasi client-side dan server-side.
- Pesan error spesifik.
- State loading dan disabled saat submit.

### 12.4 Dashboard

- Kartu ringkasan.
- Tabel top performer.

---

## 13. Monitoring dan Logging

- Request log dasar (`method`, `route`, `status`, `duration`).
- Error log server dengan stack trace.
- Audit log untuk create/update/delete season/club/player.
- Audit log untuk update stats.
- Audit log untuk perubahan assignment player-club.

---

## 14. Rencana Rilis

| Milestone          | Timeline   | Deliverable                                               |
| ------------------ | ---------- | --------------------------------------------------------- |
| Foundation         | Minggu 1-2 | Setup project, auth, RBAC, struktur database              |
| Master Data        | Minggu 3-4 | CRUD season, club, player + validasi                      |
| Assignment & Stats | Minggu 5-6 | Player club history, input/update stats, auto history     |
| Analytics View     | Minggu 7   | Filter/search, dashboard summary                          |
| Hardening          | Minggu 8   | Performance tuning, QA regression, UAT, release candidate |

---

## 15. Testing dan Kriteria UAT

### 15.1 Cakupan Testing

- Unit test untuk validator dan aturan bisnis inti.
- Integration test endpoint kritis: auth, assignment player-club, update stats + history.
- End-to-end test untuk user journey utama.

### 15.2 Exit Criteria UAT

- Semua requirement FR-01 s.d. FR-12 lulus.
- Tidak ada bug severity high/critical.
- p95 API utama memenuhi target performa.
- Stakeholder admin dan analyst menyetujui alur kerja.

---

## 16. Risiko dan Mitigasi

| Risiko                           | Dampak                   | Mitigasi                                    |
| -------------------------------- | ------------------------ | ------------------------------------------- |
| Data tidak konsisten antar modul | Insight salah            | FK, unique constraint, validasi server      |
| Query lambat pada data besar     | UX buruk                 | Indexing, pagination, optimasi query        |
| Penyalahgunaan akses             | Kebocoran/perubahan data | RBAC ketat, auth middleware, audit log      |
| Human error saat input           | Data noisy               | Validasi form, range check, konfirmasi aksi |

---

## 17. Open Questions

- Apakah statistik disimpan per season total atau per pertandingan?
- Apakah ada kebutuhan multi-competition dalam 1 season?
- Apakah analyst perlu fitur export CSV/Excel pada fase MVP?
- Apakah dibutuhkan approval flow sebelum data statistik dipublikasikan?

---

## 18. Lampiran User Flow

`Login -> Dashboard -> Manage Season/Club/Player -> Assign Player to Club -> Input/Update Stats -> View Filter/Search -> View History & Summary`
