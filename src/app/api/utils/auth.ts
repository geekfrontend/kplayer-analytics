import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import jwt, { JwtPayload } from "jsonwebtoken";
import { NextRequest } from "next/server";
import { orm } from "@/db/sqlite";
import { sessions, users } from "@/db/schema";
import { ApiError } from "./api-error";

export type UserRole = "admin" | "analyst";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

type SessionUserRow = UserRow & {
  expires_at: string;
};

type AccessTokenPayload = JwtPayload & {
  sub: string;
  email: string;
  role: UserRole;
};

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-secret-change-this";
const ACCESS_TOKEN_EXPIRES_IN_SECONDS = Number(
  process.env.ACCESS_TOKEN_EXPIRES_IN_SECONDS ?? 3600,
);

export function hashPassword(plainText: string) {
  return bcrypt.hashSync(plainText, 10);
}

export function verifyPassword(plainText: string, passwordHash: string) {
  return bcrypt.compareSync(plainText, passwordHash);
}

export function signAccessToken(user: UserRow) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
    },
  );
}

export function getAccessTokenExpiresInSeconds() {
  return ACCESS_TOKEN_EXPIRES_IN_SECONDS;
}

export function getBearerToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    throw ApiError.unauthorized("Authorization header tidak ditemukan");
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    throw ApiError.unauthorized("Format Authorization harus Bearer <token>");
  }

  return token;
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload || typeof payload === "string") {
      throw new Error("Invalid JWT payload");
    }
    if (!payload.sub || !payload.email || !payload.role) {
      throw new Error("JWT payload tidak lengkap");
    }

    return payload as AccessTokenPayload;
  } catch {
    throw ApiError.unauthorized("Token tidak valid atau sudah kedaluwarsa");
  }
}

export function createSession(
  userId: string,
  token: string,
  expiresAt: string,
) {
  orm
    .insert(sessions)
    .values({
      id: randomUUID(),
      user_id: userId,
      token,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    })
    .run();
}

export function deleteSessionByToken(token: string) {
  orm.delete(sessions).where(eq(sessions.token, token)).run();
}

export function findUserByEmail(email: string) {
  const result = orm
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      password_hash: users.password_hash,
      role: users.role,
    })
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deleted_at)))
    .limit(1)
    .get();

  return result as
    | (UserRow & {
        password_hash: string;
      })
    | undefined;
}

export function requireAuth(req: NextRequest): UserRow {
  const token = getBearerToken(req);
  const payload = verifyAccessToken(token);

  const sessionUser = orm
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      expires_at: sessions.expires_at,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.user_id))
    .where(and(eq(sessions.token, token), isNull(users.deleted_at)))
    .limit(1)
    .get() as SessionUserRow | undefined;

  if (!sessionUser) {
    throw ApiError.unauthorized("Session tidak ditemukan");
  }

  if (new Date(sessionUser.expires_at).getTime() <= Date.now()) {
    deleteSessionByToken(token);
    throw ApiError.unauthorized("Session sudah kedaluwarsa");
  }

  if (sessionUser.id !== payload.sub) {
    throw ApiError.unauthorized("Token tidak cocok dengan session");
  }

  return {
    id: sessionUser.id,
    name: sessionUser.name,
    email: sessionUser.email,
    role: sessionUser.role,
  };
}

export function requireRole(user: UserRow, allowedRoles: UserRole[]) {
  if (!allowedRoles.includes(user.role)) {
    throw ApiError.forbidden("Anda tidak memiliki akses");
  }
}
