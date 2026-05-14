# KPlayer Analytics — Product Requirements Document

## 1. Ringkasan Produk

KPlayer Analytics adalah aplikasi web fullstack untuk mengelola data pemain sepak bola lintas liga, musim, dan klub. Aplikasi ini memungkinkan pencatatan statistik pemain, pemeliharaan riwayat perubahan data secara immutable, serta penyediaan dasbor analitik berbasis filter liga dan musim aktif.

**Stack Teknologi**
- Framework: Next.js 16 (App Router, React Server Components)
- Database: PostgreSQL dengan Drizzle ORM
- UI: shadcn/ui (New York style) + Tailwind CSS v4
- Forms: React Hook Form + Zod
- Data Fetching: TanStack Query
- Auth: JWT + session-based (bcryptjs, jsonwebtoken)

---

## 2. Tujuan Produk

- Memusatkan data performa pemain sepak bola lintas liga, musim, dan klub
- Menjaga riwayat immutable dari setiap perubahan statistik
- Memungkinkan evaluasi pemain berbasis data dengan filter dan dasbor ringkasan
- Mendukung multi-liga dengan konteks aktif per pengguna

---

## 3. Peran Pengguna

| Peran | Hak Akses |
|-------|-----------|
| **Admin** | CRUD penuh untuk semua data: liga, musim, klub, pemain, penugasan, statistik, pengguna |
| **Analis** | Akses baca saja untuk semua data; dapat memfilter dan melihat dasbor |

---

## 4. Domain & Fitur

### 4.1 Autentikasi & Sesi

- Login dengan email dan password
- JWT access token disimpan di localStorage
- Session disimpan di database dengan waktu kedaluwarsa
- Logout menghapus session dari database
- Endpoint `GET /api/auth/me` untuk validasi sesi aktif

### 4.2 Manajemen Pengguna (Admin)

- CRUD pengguna dengan role `admin` atau `analyst`
- Soft delete (kolom `deleted_at`) — pengguna tidak benar-benar dihapus
- Reset password oleh admin — menginvalidasi semua session pengguna tersebut
- Filter berdasarkan nama, email, dan role

### 4.3 Liga (Master Data)

- CRUD liga: nama dan negara asal
- Liga adalah entitas master yang menjadi konteks utama navigasi
- Setiap musim dapat dikaitkan ke satu liga
- **Active League**: setiap pengguna menyimpan `active_league_id` di profil mereka
- Liga aktif digunakan untuk memfilter musim dan klub yang ditampilkan

### 4.4 Musim

- CRUD musim dengan format nama `YYYY/YYYY` (contoh: `2024/2025`)
- Setiap musim terhubung ke satu liga (`league_id`, nullable)
- Field: nama, liga, tanggal mulai, tanggal selesai, status aktif (`is_active`)
- **Active Season**: setiap pengguna menyimpan `active_season_id` di profil mereka
- Musim aktif digunakan sebagai konteks untuk semua data domain

### 4.5 Klub

- CRUD klub: nama saja (negara dihapus — konteks negara diambil dari liga)
- Klub bersifat global, tidak terikat ke liga atau musim secara langsung
- Pendaftaran klub ke musim dilakukan via `season_clubs`

### 4.6 Relasi Musim-Klub (`season_clubs`)

- Junction table yang menghubungkan klub ke musim tertentu
- Unique constraint: satu klub hanya bisa terdaftar sekali per musim
- Prasyarat untuk membuat penugasan pemain dan statistik

### 4.7 Penugasan Pemain (`player_club_history`)

- Mencatat pemain bermain di klub mana pada musim tertentu
- Field: pemain, musim, klub, tanggal bergabung, tanggal keluar (opsional), status aktif
- Satu pemain hanya boleh punya satu penugasan aktif per musim
- Prasyarat untuk membuat statistik pemain

### 4.8 Statistik Pemain (`player_stats`)

- Mencatat statistik pemain per kombinasi (pemain, musim, klub)
- Field: menit bermain, gol, assist, tembakan
- Constraint: `shots >= goals`
- Unique per kombinasi (player, season, club)
- Setiap pembaruan statistik otomatis menyimpan snapshot sebelum dan sesudah ke `player_stats_history`

### 4.9 Riwayat Statistik (`player_stats_history`)

- Audit trail immutable untuk setiap perubahan statistik
- Menyimpan `before_payload` dan `after_payload` sebagai JSON string
- Mencatat siapa yang mengubah (`changed_by`) dan kapan (`changed_at`)

### 4.10 Dasbor

- Endpoint `GET /api/dashboard/summary?season_id=` mengembalikan:
  - Total pemain unik di musim tersebut
  - Top scorer (pemain dengan total gol terbanyak)
  - Top assist (pemain dengan total assist terbanyak)

---

## 5. Flow Navigasi Utama

### 5.1 Flow Login & Pemilihan Konteks

```
Login
  ↓
Validasi sesi (GET /api/auth/me)
  ↓
Cek active_league_id
  ├── Tidak ada → Dialog "Pilih Liga" (Step 1)
  │     ↓ Pilih liga → PATCH /api/auth/active-league
  │     ↓ Dialog "Pilih Musim" (Step 2, difilter by liga)
  │     ↓ Pilih musim → PATCH /api/auth/active-season
  │     ↓ Masuk Dashboard
  └── Ada → Cek active_season_id
        ├── Tidak ada → Dialog "Pilih Musim" (Step 2)
        └── Ada → Masuk Dashboard
```

### 5.2 Switcher di Header

- **League Switcher**: dropdown pilih liga aktif, dengan form tambah liga (admin)
  - Mengganti liga → reset season aktif (user harus pilih season baru)
- **Season Switcher**: dropdown pilih musim, difilter berdasarkan liga aktif
  - Dengan form tambah musim (admin)

### 5.3 Halaman Klub

- Menampilkan semua klub
- Kolom status menunjukkan apakah klub terdaftar di musim aktif
- Jika ada filter liga aktif, tabel difilter hanya menampilkan klub yang terdaftar di musim aktif
- Admin dapat mendaftarkan/mengeluarkan klub dari musim aktif langsung dari tabel

---

## 6. API Endpoints

### Auth
| Method | Endpoint | Akses | Deskripsi |
|--------|----------|-------|-----------|
| POST | `/api/auth/login` | Public | Login, buat session, return JWT |
| POST | `/api/auth/logout` | Bearer | Hapus session |
| GET | `/api/auth/me` | Bearer | Data pengguna saat ini |
| PATCH | `/api/auth/active-season` | Bearer | Set musim aktif pengguna |
| PATCH | `/api/auth/active-league` | Bearer | Set liga aktif pengguna |
| DELETE | `/api/auth/active-league` | Bearer | Hapus liga aktif (kembali ke semua liga) |

### Pengguna
| Method | Endpoint | Akses | Deskripsi |
|--------|----------|-------|-----------|
| GET | `/api/users` | Admin | List pengguna |
| POST | `/api/users` | Admin | Buat pengguna |
| GET | `/api/users/[id]` | Admin | Detail pengguna |
| PATCH | `/api/users/[id]` | Admin | Update pengguna |
| DELETE | `/api/users/[id]` | Admin | Soft delete pengguna |
| PATCH | `/api/users/[id]/reset-password` | Admin | Reset password |

### Liga
| Method | Endpoint | Akses | Deskripsi |
|--------|----------|-------|-----------|
| GET | `/api/leagues` | Bearer | List liga |
| POST | `/api/leagues` | Admin | Buat liga |
| GET | `/api/leagues/[id]` | Bearer | Detail liga |
| PATCH | `/api/leagues/[id]` | Admin | Update liga |
| DELETE | `/api/leagues/[id]` | Admin | Hapus liga |

### Musim
| Method | Endpoint | Akses | Deskripsi |
|--------|----------|-------|-----------|
| GET | `/api/seasons` | Bearer | List musim (filter: `q`, `league_id`) |
| POST | `/api/seasons` | Admin | Buat musim |
| GET | `/api/seasons/[id]` | Bearer | Detail musim (include data liga) |
| PATCH | `/api/seasons/[id]` | Admin | Update musim |
| DELETE | `/api/seasons/[id]` | Admin | Hapus musim |

### Klub
| Method | Endpoint | Akses | Deskripsi |
|--------|----------|-------|-----------|
| GET | `/api/clubs` | Bearer | List klub (filter: `q`) |
| POST | `/api/clubs` | Admin | Buat klub |
| GET | `/api/clubs/[id]` | Bearer | Detail klub |
| PATCH | `/api/clubs/[id]` | Admin | Update klub |
| DELETE | `/api/clubs/[id]` | Admin | Hapus klub |

### Pemain
| Method | Endpoint | Akses | Deskripsi |
|--------|----------|-------|-----------|
| GET | `/api/players` | Bearer | List pemain (filter: `q`) |
| POST | `/api/players` | Admin | Buat pemain |
| GET | `/api/players/[id]` | Bearer | Detail pemain |
| PATCH | `/api/players/[id]` | Admin | Update pemain |
| DELETE | `/api/players/[id]` | Admin | Hapus pemain |
| GET | `/api/search/players` | Bearer | Cari pemain by nama |

### Relasi Musim-Klub
| Method | Endpoint | Akses | Deskripsi |
|--------|----------|-------|-----------|
| GET | `/api/season-clubs` | Bearer | List relasi (filter: `season_id`, `club_id`) |
| POST | `/api/season-clubs` | Admin | Daftarkan klub ke musim |
| DELETE | `/api/season-clubs/[id]` | Admin | Hapus relasi |

### Penugasan Pemain
| Method | Endpoint | Akses | Deskripsi |
|--------|----------|-------|-----------|
| GET | `/api/player-club-history` | Bearer | List penugasan (filter: `player_id`, `season_id`, `club_id`, `is_active`) |
| POST | `/api/player-club-history` | Admin | Buat penugasan |
| PATCH | `/api/player-club-history/[id]` | Admin | Update penugasan |
| DELETE | `/api/player-club-history/[id]` | Admin | Hapus penugasan |

### Statistik Pemain
| Method | Endpoint | Akses | Deskripsi |
|--------|----------|-------|-----------|
| GET | `/api/player-stats` | Bearer | List statistik (filter: `player_id`, `season_id`, `club_id`) |
| POST | `/api/player-stats` | Admin | Buat statistik |
| GET | `/api/player-stats/[id]` | Bearer | Detail statistik |
| PATCH | `/api/player-stats/[id]` | Admin | Update statistik (auto-create history) |
| GET | `/api/player-stats/[id]/history` | Bearer | Riwayat perubahan statistik |
| GET | `/api/stats` | Bearer | Statistik dengan sorting (`goals`, `assists`, `minutes_played`, `updated_at`) |

### Dasbor & Lainnya
| Method | Endpoint | Akses | Deskripsi |
|--------|----------|-------|-----------|
| GET | `/api/dashboard/summary` | Bearer | Ringkasan: total pemain, top scorer, top assist |
| GET | `/api/health` | Public | Health check |
| GET | `/api` | Public | Info service |

---

## 7. Aturan Bisnis

1. **Hierarki konteks**: Liga → Musim → Klub → Pemain → Statistik
2. **Prasyarat statistik**: Pemain harus punya penugasan aktif di kombinasi (musim, klub) sebelum statistik bisa dibuat atau diperbarui
3. **Prasyarat penugasan**: Klub harus terdaftar di musim tersebut via `season_clubs` sebelum pemain bisa ditugaskan
4. **Satu penugasan aktif per musim**: Satu pemain hanya boleh punya satu penugasan `is_active = 1` per musim
5. **Statistik unik per scope**: Satu pemain hanya boleh punya satu record statistik per kombinasi (pemain, musim, klub)
6. **Constraint statistik**: `shots >= goals`, semua nilai `>= 0`
7. **Riwayat immutable**: Setiap PATCH pada `player_stats` otomatis membuat record di `player_stats_history` dalam satu transaksi
8. **Soft delete pengguna**: Pengguna yang dihapus tidak benar-benar dihapus dari database; semua session-nya diinvalidasi
9. **Ganti liga → reset season**: Saat pengguna mengganti liga aktif, season aktif direset dan pengguna harus memilih season baru dari liga tersebut
10. **Format musim**: Nama musim harus mengikuti format `YYYY/YYYY` dengan tahun kedua = tahun pertama + 1

---

## 8. Entity Relationship Diagram (ERD)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           KPLAYER ANALYTICS ERD                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────────────────────────────────────────┐
│    users     │         │                    leagues                        │
├──────────────┤         ├──────────────────────────────────────────────────┤
│ id (PK)      │         │ id (PK)                                          │
│ name         │         │ name (UNIQUE)                                    │
│ email (UQ)   │         │ country                                          │
│ password_hash│         │ created_at                                       │
│ role         │         │ updated_at                                       │
│ active_season_id (FK)──┼──────────────────────────────────────────────────┼──┐
│ active_league_id (FK)──┼──────────────────────────────────────────────────┘  │
│ created_at   │         │                                                      │
│ updated_at   │         │                                                      │
│ deleted_at   │         │                                                      │
└──────┬───────┘         └──────────────────────────────────────────────────┘  │
       │                                      │ 1                               │
       │ 1                                    │                                 │
       │                                      ▼ N                               │
┌──────▼───────┐         ┌──────────────────────────────────────────────────┐  │
│   sessions   │         │                   seasons                         │  │
├──────────────┤         ├──────────────────────────────────────────────────┤  │
│ id (PK)      │         │ id (PK)                                          │◄─┘
│ user_id (FK) │         │ name (UNIQUE)  format: YYYY/YYYY                 │
│ token (UQ)   │         │ league_id (FK) ──────────────────────────────────┼──► leagues
│ expires_at   │         │ start_date                                       │
│ created_at   │         │ end_date                                         │
└──────────────┘         │ is_active (0|1)                                  │
                         │ created_at                                       │
                         │ updated_at                                       │
                         └──────────────────────┬───────────────────────────┘
                                                │ 1
                                                │
                         ┌──────────────────────┼───────────────────────────┐
                         │                      │                           │
                         ▼ N                    ▼ N                         ▼ N
          ┌──────────────────────┐  ┌───────────────────────┐  ┌────────────────────────┐
          │    season_clubs      │  │  player_club_history  │  │     player_stats       │
          ├──────────────────────┤  ├───────────────────────┤  ├────────────────────────┤
          │ id (PK)              │  │ id (PK)               │  │ id (PK)                │
          │ season_id (FK) ──────┼──┤ season_id (FK) ───────┼──┤ season_id (FK)         │
          │ club_id (FK) ────────┼──┤ club_id (FK) ─────────┼──┤ club_id (FK)           │
          │ created_at           │  │ player_id (FK) ────────┼──┤ player_id (FK)         │
          │                      │  │ join_date             │  │ minutes_played (≥0)    │
          │ UNIQUE(season_id,    │  │ leave_date (nullable) │  │ goals (≥0)             │
          │        club_id)      │  │ is_active (0|1)       │  │ assists (≥0)           │
          └──────────────────────┘  │ created_at            │  │ shots (≥goals)         │
                    │               │ updated_at            │  │ created_at             │
                    │               │                       │  │ updated_at             │
                    │               │ UNIQUE: satu aktif    │  │ created_by (FK→users)  │
                    │               │ per player per season │  │ updated_by (FK→users)  │
                    │               └───────────────────────┘  │                        │
                    │                          │                │ UNIQUE(player_id,      │
                    │                          │                │        season_id,      │
                    │                          │                │        club_id)        │
                    │                          │                └────────────┬───────────┘
                    │                          │                             │ 1
                    ▼                          ▼                             │
          ┌──────────────────────┐  ┌───────────────────────┐               ▼ N
          │        clubs         │  │       players         │  ┌────────────────────────┐
          ├──────────────────────┤  ├───────────────────────┤  │  player_stats_history  │
          │ id (PK)              │  │ id (PK)               │  ├────────────────────────┤
          │ name (UNIQUE)        │  │ full_name             │  │ id (PK)                │
          │ created_at           │  │ date_of_birth         │  │ player_stats_id (FK)   │
          │ updated_at           │  │ nationality (nullable)│  │ before_payload (JSON)  │
          └──────────────────────┘  │ primary_position      │  │ after_payload (JSON)   │
                                    │ created_at            │  │ changed_by (FK→users)  │
                                    │ updated_at            │  │ changed_at             │
                                    └───────────────────────┘  └────────────────────────┘
```

---

## 9. Struktur Tabel Lengkap

### `users`
| Kolom | Tipe | Constraint |
|-------|------|-----------|
| id | TEXT | PK |
| name | TEXT | NOT NULL |
| email | TEXT | NOT NULL, UNIQUE |
| password_hash | TEXT | NOT NULL |
| role | TEXT | NOT NULL, ENUM('admin','analyst') |
| active_season_id | TEXT | FK → seasons(id) ON DELETE SET NULL |
| active_league_id | TEXT | FK → leagues(id) ON DELETE SET NULL |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |
| deleted_at | TEXT | nullable (soft delete) |

### `sessions`
| Kolom | Tipe | Constraint |
|-------|------|-----------|
| id | TEXT | PK |
| user_id | TEXT | NOT NULL, FK → users(id) ON DELETE CASCADE |
| token | TEXT | NOT NULL, UNIQUE |
| expires_at | TEXT | NOT NULL |
| created_at | TEXT | NOT NULL |

### `leagues`
| Kolom | Tipe | Constraint |
|-------|------|-----------|
| id | TEXT | PK |
| name | TEXT | NOT NULL, UNIQUE |
| country | TEXT | NOT NULL |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |

### `seasons`
| Kolom | Tipe | Constraint |
|-------|------|-----------|
| id | TEXT | PK |
| name | TEXT | NOT NULL, UNIQUE, format YYYY/YYYY |
| league_id | TEXT | FK → leagues(id) ON DELETE RESTRICT, nullable |
| start_date | TEXT | NOT NULL |
| end_date | TEXT | NOT NULL |
| is_active | INTEGER | NOT NULL, DEFAULT 0, CHECK IN (0,1) |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |

### `clubs`
| Kolom | Tipe | Constraint |
|-------|------|-----------|
| id | TEXT | PK |
| name | TEXT | NOT NULL, UNIQUE |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |

### `players`
| Kolom | Tipe | Constraint |
|-------|------|-----------|
| id | TEXT | PK |
| full_name | TEXT | NOT NULL |
| date_of_birth | TEXT | NOT NULL |
| nationality | TEXT | nullable |
| primary_position | TEXT | NOT NULL |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |

### `season_clubs`
| Kolom | Tipe | Constraint |
|-------|------|-----------|
| id | TEXT | PK |
| season_id | TEXT | NOT NULL, FK → seasons(id) ON DELETE RESTRICT |
| club_id | TEXT | NOT NULL, FK → clubs(id) ON DELETE RESTRICT |
| created_at | TEXT | NOT NULL |
| | | UNIQUE(season_id, club_id) |

### `player_club_history`
| Kolom | Tipe | Constraint |
|-------|------|-----------|
| id | TEXT | PK |
| player_id | TEXT | NOT NULL, FK → players(id) ON DELETE RESTRICT |
| season_id | TEXT | NOT NULL, FK → seasons(id) ON DELETE RESTRICT |
| club_id | TEXT | NOT NULL, FK → clubs(id) ON DELETE RESTRICT |
| join_date | TEXT | NOT NULL |
| leave_date | TEXT | nullable, CHECK ≥ join_date |
| is_active | INTEGER | NOT NULL, DEFAULT 1, CHECK IN (0,1) |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |

### `player_stats`
| Kolom | Tipe | Constraint |
|-------|------|-----------|
| id | TEXT | PK |
| player_id | TEXT | NOT NULL, FK → players(id) ON DELETE RESTRICT |
| season_id | TEXT | NOT NULL, FK → seasons(id) ON DELETE RESTRICT |
| club_id | TEXT | NOT NULL, FK → clubs(id) ON DELETE RESTRICT |
| minutes_played | INTEGER | NOT NULL, CHECK ≥ 0 |
| goals | INTEGER | NOT NULL, CHECK ≥ 0 |
| assists | INTEGER | NOT NULL, CHECK ≥ 0 |
| shots | INTEGER | NOT NULL, CHECK ≥ goals |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |
| created_by | TEXT | NOT NULL, FK → users(id) ON DELETE RESTRICT |
| updated_by | TEXT | NOT NULL, FK → users(id) ON DELETE RESTRICT |
| | | UNIQUE(player_id, season_id, club_id) |

### `player_stats_history`
| Kolom | Tipe | Constraint |
|-------|------|-----------|
| id | TEXT | PK |
| player_stats_id | TEXT | NOT NULL, FK → player_stats(id) ON DELETE CASCADE |
| before_payload | TEXT | NOT NULL (JSON string) |
| after_payload | TEXT | NOT NULL (JSON string) |
| changed_by | TEXT | NOT NULL, FK → users(id) ON DELETE RESTRICT |
| changed_at | TEXT | NOT NULL |

---

## 10. Indeks Database

| Indeks | Tabel | Kolom | Tipe |
|--------|-------|-------|------|
| idx_leagues_name | leagues | name | Regular |
| uq_season_clubs_pair | season_clubs | (season_id, club_id) | Unique |
| idx_season_clubs_season | season_clubs | season_id | Regular |
| idx_season_clubs_club | season_clubs | club_id | Regular |
| idx_player_club_history_player_season | player_club_history | (player_id, season_id) | Regular |
| idx_player_club_history_club_season | player_club_history | (club_id, season_id) | Regular |
| uq_player_stats_scope | player_stats | (player_id, season_id, club_id) | Unique |
| idx_player_stats_season_club | player_stats | (season_id, club_id) | Regular |
| idx_player_stats_player_season | player_stats | (player_id, season_id) | Regular |
| idx_player_stats_goals | player_stats | goals | Regular |
| idx_player_stats_assists | player_stats | assists | Regular |
| idx_player_stats_history_changed_at | player_stats_history | changed_at | Regular |
| idx_player_stats_history_stats_changed | player_stats_history | (player_stats_id, changed_at) | Regular |
| idx_players_full_name | players | full_name | Regular |

---

## 11. Komponen Frontend Utama

| Komponen | Lokasi | Deskripsi |
|----------|--------|-----------|
| `ChooseContextDialog` | `components/app/` | Dialog 2 langkah: pilih liga → pilih musim |
| `LeagueSwitcher` | `components/app/` | Popover ganti liga aktif + form tambah liga (admin) |
| `SeasonSwitcher` | `components/app/` | Popover ganti musim aktif (difilter by liga) + form tambah musim (admin) |
| `ActiveLeagueProvider` | `components/app/` | Context provider untuk liga aktif |
| `ActiveSeasonProvider` | `components/app/` | Context provider untuk musim aktif |
| `AuthUserProvider` | `components/app/` | Context provider untuk data pengguna |

### Halaman Protected
| Halaman | Path | Deskripsi |
|---------|------|-----------|
| Dasbor | `/` | Ringkasan statistik musim aktif |
| Liga | `/leagues` | CRUD liga |
| Klub | `/clubs` | CRUD klub + status pendaftaran di musim aktif |
| Pemain | `/players` | CRUD pemain |
| Relasi Musim-Klub | `/season-clubs` | Manajemen pendaftaran klub ke musim |
| Penugasan | `/assignments` | Manajemen penugasan pemain ke klub per musim |
| Statistik Pemain | `/player-stats` | Input dan lihat statistik pemain |
| Pengguna | `/users` | CRUD pengguna (admin only) |

---

## 12. Riwayat Perubahan

| Versi | Perubahan |
|-------|-----------|
| MVP 1 | Autentikasi, manajemen pengguna, session |
| MVP 2 | Master data: musim, klub, pemain |
| MVP 3 | Domain: season_clubs, player_club_history, player_stats, player_stats_history |
| MVP 4 | Indeks database untuk performa query |
| MVP 5 | Active season per pengguna (`users.active_season_id`) |
| MVP 6 | Master data liga; `seasons.league_id`; hapus `clubs.country`; active league per pengguna (`users.active_league_id`) |
| MVP 7 | Flow pilih liga dulu baru musim; `ChooseContextDialog` 2 langkah menggantikan `ChooseSeasonDialog`; `LeagueSwitcher` reset season saat liga diganti; `SeasonSwitcher` filter seasons berdasarkan liga aktif |
| MVP 8 | Hapus `seasons.deleted_at` dari schema (tidak pernah ada di DB); fix insert seasons dengan `league_id` string kosong (transform ke `null` di Zod); `SeasonSwitcher` otomatis set `league_id` ke liga aktif saat buat musim baru; `staleTime: 0` pada query seasons di switcher |
