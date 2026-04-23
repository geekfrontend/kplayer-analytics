# MVP 4 - Analytics, Search, Dashboard, Hardening

## 1. Tujuan MVP

Menutup kebutuhan analitik dasar produk:

- filtering lintas season/club/player,
- search pemain,
- dashboard summary (top scorer, top assist, total pemain),
- hardening performa, observability, dan quality gate.

## 2. Fitur

- Endpoint query statistik dengan kombinasi filter.
- Endpoint search pemain berbasis nama.
- Endpoint dashboard summary per season.
- Pagination dan sorting standar.
- Logging request dan global error handler.
- Konsistensi response menggunakan `ApiResponse`.

## 3. Skema Database (Tambahan Index untuk SQLite)

```sql
CREATE INDEX idx_player_stats_season_club
  ON player_stats(season_id, club_id);

CREATE INDEX idx_player_stats_player_season
  ON player_stats(player_id, season_id);

CREATE INDEX idx_player_stats_goals
  ON player_stats(goals DESC);

CREATE INDEX idx_player_stats_assists
  ON player_stats(assists DESC);

CREATE INDEX idx_player_stats_history_changed_at
  ON player_stats_history(changed_at DESC);

CREATE INDEX idx_players_full_name
  ON players(full_name);
```

## 4. Endpoint API

### Query & Search

- `GET /api/stats?season_id=<id>&club_id=<id>&player_id=<id>&page=1&limit=20`
- `GET /api/search/players?q=<keyword>&page=1&limit=20`

### Dashboard

- `GET /api/dashboard/summary?season_id=<id>`

Response `summary.data` contoh:

```json
{
  "season_id": "season_2024_2025",
  "total_players": 120,
  "top_scorer": [
    { "player_id": "p1", "full_name": "Player A", "goals": 24 }
  ],
  "top_assist": [
    { "player_id": "p2", "full_name": "Player B", "assists": 19 }
  ]
}
```

## 5. Validasi dan Response Contract

- Parameter query harus tervalidasi (`uuid/text`, integer pagination).
- Batas default pagination: `limit=20`, maksimum `limit=100`.
- Query dashboard wajib `season_id` valid.
- Semua endpoint tetap memakai response envelope standar.

## 6. Error Handling dan Observability

- Global error mapper dari error domain -> HTTP status code.
- Request logger minimal: `request_id`, method, path, status, duration.
- Standard not found payload untuk resource/query kosong.
- Gunakan logger Winston dari `src/app/api/utils/logger.ts`.

## 7. Unit dan Integration Test Minimum

- Filter stats by season.
- Filter stats by season + club.
- Search players by keyword (case insensitive).
- Dashboard summary mengembalikan top scorer dan top assist.
- Pagination metadata (`page`, `limit`, `total`) benar.
- Endpoint protected menolak token invalid.

## 8. Definition of Done (DoD)

- Semua endpoint query/search/dashboard berjalan stabil.
- p95 endpoint utama sesuai target pada PRD.
- Test integration untuk jalur kritis analitik lulus.
- Dokumentasi API siap handoff ke frontend/QA.

## 9. Checklist Rilis API v1

- Freeze schema SQLite v1.
- Pastikan migration urut dari MVP 1 -> 4.
- Seed data demo untuk QA/UAT.
- Jalankan test suite + lint + typecheck pada CI.
- Tag release: `api-v1.0.0`.

## 10. Catatan Sinkronisasi dengan Kode Saat Ini

- Status code standar mengacu pada `src/app/api/constants/status-codes.ts`.
- Seluruh route sebaiknya mengadopsi wrapper `RouteHandler`.
- Pastikan field response mengikuti shape `ApiResponse` yang sudah ada.
