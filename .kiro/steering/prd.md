# KPlayer Analytics — Product Requirements Document

## 1. Ringkasan Produk

KPlayer Analytics adalah aplikasi web fullstack untuk mengelola data pemain sepak bola lintas liga, musim, dan klub. Aplikasi ini memungkinkan pencatatan statistik pemain, pemeliharaan riwayat perubahan data secara immutable, serta penyediaan dasbor analitik dan analisis performa berbasis K-Means clustering.

**Stack Teknologi**
- Framework: Next.js 16 (App Router, React Server Components)
- Database: PostgreSQL dengan Drizzle ORM
- UI: shadcn/ui (New York style) + Tailwind CSS v4
- Forms: React Hook Form + Zod
- Data Fetching: TanStack Query
- Auth: JWT + session-based (bcryptjs, jsonwebtoken)
- Tabel: TanStack Table v8

---

## 2. Tujuan Produk

- Memusatkan data performa pemain sepak bola lintas liga, musim, dan klub
- Menjaga riwayat immutable dari setiap perubahan statistik
- Memungkinkan evaluasi pemain berbasis data dengan filter dan dasbor ringkasan
- Mendukung multi-liga dengan konteks aktif per pengguna
- Menyediakan analisis performa pemain berbasis machine learning (K-Means clustering)

---

## 3. Peran Pengguna

| Peran | Hak Akses |
|-------|-----------|
| **Admin** | CRUD penuh untuk semua data: liga, musim, klub, pemain, statistik, pengguna |
| **Analis** | Akses baca saja untuk semua data; dapat memfilter, melihat dasbor, dan analisis |

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

- CRUD liga via `LeagueSwitcher` (popover dropdown di header)
- Soft delete (kolom `deleted_at`)
- Liga adalah entitas master yang menjadi konteks utama navigasi
- **Active League**: setiap pengguna menyimpan `active_league_id` di profil

### 4.4 Musim

- CRUD musim via `SeasonSwitcher` (popover dropdown di header)
- Soft delete (kolom `deleted_at`)
- Format nama: `YYYY/YYYY` (contoh: `2024/2025`)
- Setiap musim terhubung ke satu liga (`league_id`, nullable)
- Unique per kombinasi `(name, league_id)` — musim sama bisa ada di liga berbeda
- **Active Season**: setiap pengguna menyimpan `active_season_id` di profil

### 4.5 Klub

- CRUD klub via halaman `/clubs`: nama saja
- Soft delete (kolom `deleted_at`)
- Nama klub TIDAK unik secara global — keunikan dijamin per kombinasi `(season_id, club_id)` di `season_clubs`
- Halaman klub menampilkan klub yang terdaftar di musim aktif (via `season-clubs`)
- Tombol "Tambah" otomatis membuat klub baru DAN mendaftarkan ke musim aktif dalam satu operasi

### 4.6 Relasi Musim-Klub (`season_clubs`)

- Junction table yang menghubungkan klub ke musim tertentu
- Unique constraint: `(season_id, club_id)`
- Prasyarat untuk membuat penugasan pemain dan statistik

### 4.7 Penugasan Pemain (`player_club_history`)

- Mencatat pemain bermain di klub mana pada musim tertentu
- Dibuat otomatis saat pemain ditambahkan via halaman pemain — `join_date` = tanggal hari ini
- Field: pemain, musim, klub, tanggal bergabung, tanggal keluar (opsional), status aktif
- Satu pemain hanya boleh punya satu penugasan aktif per musim

### 4.8 Pemain

- CRUD pemain via halaman `/players`
- Posisi pemain dipilih via `Select` dengan 15 opsi standar (GK, CB, LB, RB, LWB, RWB, CDM, CM, CAM, LM, RM, LW, RW, CF, ST)
- Filter via `AsyncSelect` klub (difilter berdasarkan musim aktif)
- Auto-select klub pertama saat halaman dibuka pertama kali
- Saat tambah pemain, otomatis dibuat juga assignment ke klub + musim aktif

### 4.9 Statistik Pemain (`player_stats`)

- Dikelola via tombol icon "BarChart2" di tabel pemain — membuka dialog
- Field: menit bermain, gol, assist, tembakan
- Constraint: `shots >= goals`, semua nilai `>= 0`
- Unique per kombinasi `(player_id, season_id, club_id)`
- Tampil langsung di tabel pemain sebagai kolom Gol, Assist, Menit
- Dialog pintar: jika sudah ada data → PATCH (update), jika belum → POST (create)
- Setiap PATCH otomatis menyimpan snapshot ke `player_stats_history`

### 4.10 Riwayat Statistik (`player_stats_history`)

- Audit trail immutable untuk setiap perubahan statistik
- Menyimpan `before_payload` dan `after_payload` sebagai JSON string
- Mencatat siapa yang mengubah (`changed_by`) dan kapan (`changed_at`)

### 4.11 Dasbor

- Halaman `/` dengan 3 section:
  1. **Context banner** — musim dan liga aktif
  2. **Filter klub global** — `AsyncSelect` di atas summary cards (mempengaruhi semua data di bawahnya)
  3. **Summary cards** — Total Pemain, Top Scorer, Top Assist
  4. **Tabel statistik** — sortable per kolom Gol/Assist/Menit
- Auto-select klub pertama saat halaman dibuka pertama kali

### 4.12 Analisis K-Means (API)

- Endpoint `GET /api/analytics/kmeans` — clustering pemain berdasarkan performa
- Fitur: gol, assist, tembakan, menit bermain (semua di-normalize via z-score)
- Inisialisasi K-Means++ untuk hasil yang lebih stabil
- Output:
  - Daftar pemain dengan `cluster` dan `performance_score`
  - Ringkasan setiap kluster dengan centroid dalam unit asli
  - `top_cluster_id` — kluster dengan performa rata-rata tertinggi (kandidat "best performers")
  - `iterations` dan `converged` — info konvergensi algoritma
  - `steps` (opsional via `include_steps=true`) — riwayat tiap iterasi untuk visualisasi
- Filter: `season_id`, `club_id`, `league_id`, `k` (default 3, range 2-10), `max_iter` (10-500), `include_steps` (boolean)
- Logika algoritma di-extract ke `src/lib/kmeans.ts` agar dapat di-reuse oleh halaman frontend

### 4.13 Halaman Analisis (`/analytics`)

Halaman interaktif untuk menjalankan dan memvisualisasikan algoritma K-Means.

**Filter & parameter:**
- Filter klub via `AsyncSelect` (musim & liga otomatis dari konteks aktif)
- Pilih jumlah cluster `k` (2-10) via `Select`
- Pilih `max_iter` via `Input` numerik (10-500)
- Tombol "Jalankan Ulang" untuk re-run dengan inisialisasi centroid berbeda

**Hasil utama (cluster summary cards):**
- Satu card per cluster dengan: nomor cluster, jumlah anggota, centroid dalam unit asli (gol, assist, tembakan, menit), avg performance score
- Cluster top performer ditandai dengan badge "Top" + ring primer

**4 Tab visualisasi:**
1. **Pemain** — tabel `ClusteredPlayersTable` lengkap dengan filter cluster (semua / top performer / per cluster)
2. **Visualisasi 2D** — `ScatterChart` (Recharts) dengan pemain sebagai titik dan centroid sebagai tanda silang. Sumbu X dan Y dapat dipilih dari 4 fitur
3. **Iterasi** — `IterationStepper` dengan kontrol play/pause/prev/next/slider untuk navigasi step-by-step:
   - Banner status iterasi (inisialisasi / iterasi N / konvergen)
   - Distribusi anggota cluster sebagai bar chart
   - `CentroidDeltaTable` — centroid tiap cluster (unit asli + z-score) + delta vs iterasi sebelumnya + arah pergeseran berikutnya
   - `AssignmentMatrix` — daftar pemain dengan cluster saat ini, pemain yang baru pindah cluster ditandai khusus
4. **Pre-processing** — `FeatureStatsPanel` dengan mean/stdev tiap fitur dan rumus z-score, plus penjelasan tahapan algoritma

**Akses**: semua role (admin & analyst) dapat mengakses untuk read-only.

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

- **League Switcher**: popover dengan list liga + CRUD inline (admin)
  - Mengganti liga → reset season aktif
- **Season Switcher**: popover dengan list season + CRUD inline (admin)
  - Difilter berdasarkan liga aktif

### 5.3 Halaman Klub

- Menampilkan hanya klub yang terdaftar di musim aktif (via `GET /api/season-clubs`)
- Tombol "Tambah": create klub + register ke musim dalam satu operasi
- Tombol "Keluarkan" (icon trash): hapus relasi `season_clubs`, klub tidak ikut terhapus

### 5.4 Halaman Pemain

- Filter klub via `AsyncSelect` (auto-select klub pertama)
- Tabel menampilkan kolom data pemain + statistik (Gol, Assist, Menit) di musim+klub aktif
- 3 icon action per baris: statistik (BarChart2), edit (Pencil), hapus (Trash2)

### 5.5 Halaman Analisis

- Auto-jalankan K-Means saat halaman dibuka (filter awal: musim+liga aktif, klub kosong = semua klub)
- Pengguna dapat mengubah klub, `k`, dan `max_iter` lalu klik "Jalankan Ulang"
- 4 tab: **Pemain** (default), **Visualisasi 2D**, **Iterasi**, **Pre-processing**
- Tab Iterasi punya timeline interaktif untuk men-step iterasi mulai dari inisialisasi K-Means++ sampai konvergen

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
| DELETE | `/api/auth/active-league` | Bearer | Hapus liga aktif |

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
| GET | `/api/leagues` | Bearer | List liga (exclude soft-deleted) |
| POST | `/api/leagues` | Admin | Buat liga |
| GET | `/api/leagues/[id]` | Bearer | Detail liga |
| PATCH | `/api/leagues/[id]` | Admin | Update liga |
| DELETE | `/api/leagues/[id]` | Admin | Soft delete liga |

### Musim
| Method | Endpoint | Akses | Deskripsi |
|--------|----------|-------|-----------|
| GET | `/api/seasons` | Bearer | List musim (filter: `q`, `league_id`) |
| POST | `/api/seasons` | Admin | Buat musim |
| GET | `/api/seasons/[id]` | Bearer | Detail musim (include data liga) |
| PATCH | `/api/seasons/[id]` | Admin | Update musim |
| DELETE | `/api/seasons/[id]` | Admin | Soft delete musim |

### Klub
| Method | Endpoint | Akses | Deskripsi |
|--------|----------|-------|-----------|
| GET | `/api/clubs` | Bearer | List klub (filter: `q`) |
| POST | `/api/clubs` | Admin | Buat klub |
| GET | `/api/clubs/[id]` | Bearer | Detail klub |
| PATCH | `/api/clubs/[id]` | Admin | Update klub |
| DELETE | `/api/clubs/[id]` | Admin | Soft delete klub |

### Pemain
| Method | Endpoint | Akses | Deskripsi |
|--------|----------|-------|-----------|
| GET | `/api/players` | Bearer | List pemain (filter: `q`, `club_id`, `season_id`) |
| POST | `/api/players` | Admin | Buat pemain |
| GET | `/api/players/[id]` | Bearer | Detail pemain |
| PATCH | `/api/players/[id]` | Admin | Update pemain |
| DELETE | `/api/players/[id]` | Admin | Hapus pemain |

### Relasi Musim-Klub
| Method | Endpoint | Akses | Deskripsi |
|--------|----------|-------|-----------|
| GET | `/api/season-clubs` | Bearer | List relasi (filter: `season_id`, `club_id`) |
| POST | `/api/season-clubs` | Admin | Daftarkan klub ke musim |
| DELETE | `/api/season-clubs/[id]` | Admin | Hapus relasi |

### Penugasan Pemain
| Method | Endpoint | Akses | Deskripsi |
|--------|----------|-------|-----------|
| GET | `/api/player-club-history` | Bearer | List penugasan |
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
| GET | `/api/stats` | Bearer | Statistik dengan sorting (`goals`, `assists`, `minutes_played`, `updated_at`) |

### Dasbor & Analisis
| Method | Endpoint | Akses | Deskripsi |
|--------|----------|-------|-----------|
| GET | `/api/dashboard/summary` | Bearer | Total pemain, top scorer, top assist (filter: `season_id`, `club_id`) |
| GET | `/api/analytics/kmeans` | Bearer | K-Means clustering pemain (filter: `season_id`, `club_id`, `league_id`, `k`, `max_iter`, `include_steps`) |
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
8. **Soft delete**: `users`, `leagues`, `seasons`, `clubs` semua pakai soft delete (`deleted_at`)
9. **Ganti liga → reset season**: Saat pengguna mengganti liga aktif, season aktif direset
10. **Format musim**: Nama musim harus mengikuti format `YYYY/YYYY` dengan tahun kedua = tahun pertama + 1
11. **Nama tidak unik global**: Klub bisa punya nama sama (di klub berbeda); musim bisa punya nama sama di liga berbeda

---

## 8. Algoritma K-Means

### 8.1 Tujuan

Mengidentifikasi kelompok pemain dengan performa serupa berdasarkan 4 fitur statistik (gol, assist, tembakan, menit bermain), lalu menentukan kluster dengan rata-rata performa tertinggi sebagai "best performers".

### 8.2 Implementasi

- **Lokasi logika**: `src/lib/kmeans.ts` (pure TypeScript, dapat di-import oleh server & client)
- **Endpoint**: `src/app/api/analytics/kmeans/route.ts`
- **Halaman**: `src/app/(protected)/analytics/page.tsx` dengan komponen di `analytics/components/`
- **Library**: pure TypeScript, tanpa dependency clustering eksternal
- **Inisialisasi**: K-Means++ (probabilitas weighted oleh jarak² ke centroid terdekat)
- **Konvergensi**: berhenti saat assignment tidak berubah atau mencapai `max_iter`
- **Step recording**: opsional via flag `trackSteps` — menyimpan snapshot tiap iterasi (centroid, assignments, jumlah perubahan) untuk visualisasi

### 8.3 Pre-processing

Fitur di-standarisasi via z-score sebelum clustering:
```
z[i] = (x[i] - mean) / stddev
```

Tujuannya: skala fitur yang berbeda (mis. menit bermain hingga ribuan vs gol < 50) tidak boleh mendominasi perhitungan jarak Euclidean.

### 8.4 Performance Score

Untuk setiap pemain:
```
performance_score = z_goals + z_assists + z_shots + z_minutes
```

Skor ini cuma sum dari z-score per fitur. Pemain dengan skor positif berarti di atas rata-rata di sebagian besar fitur. Skor negatif berarti di bawah rata-rata.

### 8.5 Top Cluster

Kluster dengan `avg_performance_score` tertinggi diidentifikasi sebagai kluster pemain dengan performa terbaik. Centroid-nya di-denormalize ke unit asli untuk interpretabilitas.

### 8.6 Parameter

| Parameter | Default | Range | Deskripsi |
|-----------|---------|-------|-----------|
| `k` | 3 | 2-10 | Jumlah kluster |
| `max_iter` | 100 | 10-500 | Iterasi maksimum sebelum berhenti |
| `season_id` | — | UUID | Filter musim |
| `club_id` | — | UUID | Filter klub |
| `league_id` | — | UUID | Filter liga |
| `include_steps` | false | boolean | Sertakan riwayat tiap iterasi di response |

### 8.7 Response Schema

```ts
{
  total_players: number;
  k_used: number;  // bisa < k jika data < k
  iterations: number;        // jumlah iterasi yang dijalankan
  converged: boolean;        // true jika berhenti karena konvergen
  filters: { season_id, club_id, league_id };
  feature_means: { goals, assists, shots, minutes_played };
  feature_stds: { goals, assists, shots, minutes_played };
  clusters: [{
    cluster: number;
    size: number;
    centroid: { goals, assists, shots, minutes_played };  // unit asli
    avg_performance_score: number;
    is_top_performer: boolean;
  }];
  top_cluster_id: number;
  players: [{
    player_id, player_name, position,
    club_id, club_name, season_id, season_name,
    goals, assists, shots, minutes_played,
    cluster: number,
    performance_score: number,
  }];  // sorted: top cluster first, then by score desc
  steps: [{                  // [] jika include_steps=false
    iteration: number;       // 0 = inisialisasi
    centroids_zscore: { goals, assists, shots, minutes_played }[];
    centroids_original: { goals, assists, shots, minutes_played }[];
    new_centroids_zscore: { goals, assists, shots, minutes_played }[];
    assignments: number[];   // sejajar dengan players[]
    changed_count: number;
    converged: boolean;
  }];
}
```

---

## 9. Entity Relationship Diagram (ERD)

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
│ created_at   │         │ deleted_at                                          │
│ updated_at   │         │                                                      │
│ deleted_at   │         │                                                      │
└──────┬───────┘         └──────────────────────────────────────────────────┘  │
       │ 1                                    │ 1                               │
       │                                      ▼ N                               │
┌──────▼───────┐         ┌──────────────────────────────────────────────────┐  │
│   sessions   │         │                   seasons                         │  │
├──────────────┤         ├──────────────────────────────────────────────────┤  │
│ id (PK)      │         │ id (PK)                                          │◄─┘
│ user_id (FK) │         │ name + league_id (UNIQUE composite)              │
│ token (UQ)   │         │ league_id (FK) ──────────────────────────────────┼──► leagues
│ expires_at   │         │ start_date                                       │
│ created_at   │         │ end_date                                         │
└──────────────┘         │ is_active (0|1)                                  │
                         │ deleted_at                                       │
                         │ created_at, updated_at                           │
                         └──────────────────────┬───────────────────────────┘
                                                │ 1
                         ┌──────────────────────┼───────────────────────────┐
                         │                      │                           │
                         ▼ N                    ▼ N                         ▼ N
          ┌──────────────────────┐  ┌───────────────────────┐  ┌────────────────────────┐
          │    season_clubs      │  │  player_club_history  │  │     player_stats       │
          ├──────────────────────┤  ├───────────────────────┤  ├────────────────────────┤
          │ id (PK)              │  │ id (PK)               │  │ id (PK)                │
          │ season_id (FK)       │  │ player_id (FK)        │  │ player_id (FK)         │
          │ club_id (FK)         │  │ season_id (FK)        │  │ season_id (FK)         │
          │ created_at           │  │ club_id (FK)          │  │ club_id (FK)           │
          │ UNIQUE(season_id,    │  │ join_date             │  │ minutes_played (≥0)    │
          │        club_id)      │  │ leave_date (nullable) │  │ goals (≥0)             │
          └──────────┬───────────┘  │ is_active (0|1)       │  │ assists (≥0)           │
                     │              │ created_at, updated_at│  │ shots (≥goals)         │
                     ▼              └───────────┬───────────┘  │ created_by (FK→users)  │
          ┌──────────────────────┐              │              │ updated_by (FK→users)  │
          │        clubs         │              ▼              │ created_at, updated_at │
          ├──────────────────────┤  ┌───────────────────────┐  │ UNIQUE(player_id,      │
          │ id (PK)              │  │       players         │  │   season_id, club_id)  │
          │ name (NOT unique)    │  ├───────────────────────┤  └────────────┬───────────┘
          │ deleted_at           │  │ id (PK)               │               │ 1
          │ created_at, updated  │  │ full_name             │               ▼ N
          └──────────────────────┘  │ date_of_birth         │  ┌────────────────────────┐
                                    │ nationality (nullable)│  │  player_stats_history  │
                                    │ primary_position      │  ├────────────────────────┤
                                    │ created_at, updated_at│  │ id (PK)                │
                                    └───────────────────────┘  │ player_stats_id (FK)   │
                                                               │ before_payload (JSON)  │
                                                               │ after_payload (JSON)   │
                                                               │ changed_by (FK→users)  │
                                                               │ changed_at             │
                                                               └────────────────────────┘
```

---

## 10. Struktur Tabel Lengkap

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
| deleted_at | TEXT | nullable (soft delete) |

### `seasons`
| Kolom | Tipe | Constraint |
|-------|------|-----------|
| id | TEXT | PK |
| name | TEXT | NOT NULL, format YYYY/YYYY |
| league_id | TEXT | FK → leagues(id) ON DELETE RESTRICT, nullable |
| start_date | TEXT | NOT NULL |
| end_date | TEXT | NOT NULL |
| is_active | INTEGER | NOT NULL, DEFAULT 0, CHECK IN (0,1) |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |
| deleted_at | TEXT | nullable (soft delete) |
| | | UNIQUE(name, league_id) |

### `clubs`
| Kolom | Tipe | Constraint |
|-------|------|-----------|
| id | TEXT | PK |
| name | TEXT | NOT NULL (TIDAK unique) |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |
| deleted_at | TEXT | nullable (soft delete) |

### `players`
| Kolom | Tipe | Constraint |
|-------|------|-----------|
| id | TEXT | PK |
| full_name | TEXT | NOT NULL |
| date_of_birth | TEXT | NOT NULL |
| nationality | TEXT | nullable |
| primary_position | TEXT | NOT NULL (kode posisi: GK, CB, CM, dll) |
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

## 11. Indeks Database

| Indeks | Tabel | Kolom | Tipe |
|--------|-------|-------|------|
| idx_leagues_name | leagues | name | Regular |
| uq_seasons_name_league | seasons | (name, league_id) | Unique |
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

## 12. Komponen Frontend Utama

| Komponen | Lokasi | Deskripsi |
|----------|--------|-----------|
| `ChooseContextDialog` | `components/app/` | Dialog 2 langkah: pilih liga → pilih musim |
| `LeagueSwitcher` | `components/app/` | Popover ganti liga + CRUD inline (admin) |
| `SeasonSwitcher` | `components/app/` | Popover ganti musim + CRUD inline (admin) |
| `ActiveLeagueProvider` | `components/app/` | Context provider untuk liga aktif |
| `ActiveSeasonProvider` | `components/app/` | Context provider untuk musim aktif |
| `AuthUserProvider` | `components/app/` | Context provider untuk data pengguna |
| `AsyncSelect` | `components/ui/` | Dropdown async dengan search, lazy load, dan multi-select |

### Halaman Protected
| Halaman | Path | Deskripsi |
|---------|------|-----------|
| Dasbor | `/` | Summary cards + tabel statistik dengan filter klub global |
| Klub | `/clubs` | Daftar klub di musim aktif + CRUD |
| Pemain | `/players` | CRUD pemain + statistik per kolom + dialog kelola statistik |
| Analisis | `/analytics` | K-Means clustering interaktif dengan visualisasi proses iterasi |
| Pengguna | `/users` | CRUD pengguna (admin only) |

### Komponen Halaman Analisis (`(protected)/analytics/components/`)
| Komponen | Deskripsi |
|----------|-----------|
| `AnalyticsFilterBar` | Filter klub + parameter `k` + `max_iter` + tombol jalankan ulang |
| `ClusterSummaryCards` | Card per cluster dengan centroid (unit asli), ukuran, dan avg score |
| `ClusteredPlayersTable` | Tabel pemain dengan filter cluster (semua / top / per cluster) |
| `ClusterScatter` | Scatter plot 2D Recharts dengan sumbu pilihan |
| `IterationStepper` | Timeline interaktif iterasi dengan play/pause/slider |
| `CentroidDeltaTable` | Tabel centroid + delta vs iterasi sebelumnya |
| `AssignmentMatrix` | Daftar pemain + perpindahan cluster antar iterasi |
| `FeatureStatsPanel` | Mean/stdev tiap fitur + rumus z-score + tahapan algoritma |

### Pola Halaman (clubs, players, users)
- Card dengan header (judul + filter bar)
- Filter inline: search dengan icon, dropdown filter, tombol "Tambah"
- Tabel dengan skeleton loading 5 rows
- Kolom aksi: icon-only buttons (Pencil, Trash2, BarChart2, KeyRound)
- Pagination icon `ChevronLeft`/`ChevronRight`
- Dialog form dengan Zod validation
- AlertDialog untuk konfirmasi destructive actions

### Pola Service Layer
Setiap halaman dengan domain kompleks punya struktur:
```
(protected)/[domain]/
├── components/  — komponen UI yang menerima props
├── services/    — fungsi API call + types + query keys
└── page.tsx     — state management + komposisi
```

---

## 13. Riwayat Perubahan

| Versi | Perubahan |
|-------|-----------|
| MVP 1 | Autentikasi, manajemen pengguna, session |
| MVP 2 | Master data: musim, klub, pemain |
| MVP 3 | Domain: season_clubs, player_club_history, player_stats, player_stats_history |
| MVP 4 | Indeks database untuk performa query |
| MVP 5 | Active season per pengguna (`users.active_season_id`) |
| MVP 6 | Master data liga; `seasons.league_id`; hapus `clubs.country`; active league per pengguna |
| MVP 7 | Flow pilih liga dulu baru musim; `ChooseContextDialog`; `SeasonSwitcher` filter by liga |
| MVP 8 | Hapus `seasons.deleted_at` (sementara); fix insert seasons dengan `league_id` kosong; auto-set `league_id` di switcher |
| MVP 9 | Klub nama tidak unik (composite unique di season_clubs); musim nama unik per liga |
| MVP 10 | Soft delete untuk leagues, seasons, clubs |
| MVP 11 | Halaman Klub redesain — sumber data dari season_clubs (klub di musim aktif); icon-only buttons |
| MVP 12 | Refactor halaman Klub ke pola components/services |
| MVP 13 | Halaman Pemain redesain dengan pola yang sama; filter klub via AsyncSelect |
| MVP 14 | Hapus halaman Liga, season-clubs, assignments, player-stats — semua dikelola via switcher / halaman lain |
| MVP 15 | Dasbor baru: summary cards + tabel sortable + filter klub global |
| MVP 16 | Posisi pemain via Select dengan 15 opsi standar; statistik dikelola via dialog di halaman pemain; tampil di kolom tabel |
| MVP 17 | Halaman Pengguna redesain seragam; hapus API yang tidak terpakai (`/api/search/players`, `/api/player-stats/[id]/history`) |
| MVP 18 | **Endpoint K-Means analytics** (`/api/analytics/kmeans`) — clustering pemain berdasarkan 4 fitur statistik dengan z-score normalization dan K-Means++ initialization |
| MVP 19 | **Halaman Analisis** (`/analytics`) — visualisasi K-Means interaktif dengan 4 tab (Pemain, Visualisasi 2D, Iterasi, Pre-processing). Tab Iterasi menampilkan timeline step-by-step dengan centroid awal, perhitungan jarak, assignment cluster, perubahan centroid antar iterasi, dan distribusi anggota cluster. Logika algoritma di-extract ke `src/lib/kmeans.ts` agar dapat di-reuse server & client. API menambahkan flag `include_steps` untuk mengembalikan riwayat iterasi |
