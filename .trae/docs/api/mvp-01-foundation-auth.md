# MVP 1 - Foundation Auth

## 1. Tujuan MVP

Menyediakan fondasi API yang siap dikembangkan dengan pola Next.js App Router:

- project structure modular (`src/app/api/**`),
- SQLite connection + migration dasar,
- authentication (login/logout/me),
- RBAC dasar (`admin`, `analyst`),
- response format via `ApiResponse` dan error handling via `ApiError` + `RouteHandler`,
- unit test awal.

## 2. Fitur

- Health check endpoint.
- Login user.
- Logout user.
- Get current user (`/me`).
- Middleware auth JWT.
- Middleware role guard.
- Util logger berbasis Winston.
- Seed admin default untuk bootstrap awal.

## 3. Skema Database (SQLite Snapshot)

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'analyst')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## 4. Endpoint API

### Public

- `GET /api/health`
- `POST /api/auth/login`

### Protected

- `POST /api/auth/logout`
- `GET /api/auth/me`

## 5. Konvensi Implementasi Route

Setiap file route mengikuti pola:

```ts
import { RouteHandler } from "@/app/api/utils/route-handler";
import { ApiResponse } from "@/app/api/utils/api-response";
import { ApiError } from "@/app/api/utils/api-error";

export const POST = RouteHandler(async (req) => {
  // validation + service call
  // throw ApiError.badRequest("...");
  return ApiResponse.ok("Login success", { access_token: "..." });
});
```

## 6. Kontrak Request/Response Inti

### `POST /auth/login`

Request:

```json
{
  "email": "admin@kplayer.local",
  "password": "Password123!"
}
```

Response sukses (`ApiResponse`) contoh:

```json
{
  "success": true,
  "message": "Login success",
  "statusCode": 200,
  "data": {
    "access_token": "jwt...",
    "token_type": "Bearer",
    "expires_in": 3600
  }
}
```

Response error (`ApiResponse.error`) contoh:

```json
{
  "success": false,
  "message": "Unauthorized",
  "statusCode": 401
}
```

## 7. Error Handling

- Password salah -> `401 UNAUTHORIZED`
- Token tidak valid/expired -> `401 UNAUTHORIZED`
- Error DB tak terduga -> `500 INTERNAL_SERVER_ERROR`

## 8. Data Bootstrap

- Seed awal wajib membuat 1 user admin.
- Kredensial seed hanya untuk environment development.

## 9. Unit Test Minimum

- Login sukses.
- Login gagal (password salah).
- `GET /me` sukses dengan token valid.
- `GET /me` gagal tanpa token.
- Test helper `ApiResponse` mengembalikan shape yang benar.
- Test helper `ApiError` memetakan status code dengan benar.

## 10. Definition of Done (DoD)

- Semua endpoint auth berjalan.
- Response envelope konsisten.
- Test coverage modul `auth` minimal 80%.
- Tidak ada linter/type error.
