import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { POST as loginPost } from "../../src/app/api/auth/login/route";
import { GET as meGet } from "../../src/app/api/auth/me/route";
import {
  GET as usersGet,
  POST as usersPost,
} from "../../src/app/api/users/route";
import {
  DELETE as userDelete,
  GET as userDetailGet,
} from "../../src/app/api/users/[id]/route";
import { closePool, db, nowIsoString, orm } from "../../src/db/postgres";
import { sessions, users } from "../../src/db/schema";
import { hashPassword } from "../../src/app/api/utils/auth";

const EMPTY_CONTEXT = {
  params: Promise.resolve({}),
};

beforeAll(async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'analyst')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
});

afterAll(async () => {
  await closePool();
});

beforeEach(async () => {
  await orm.delete(sessions).run();
  await orm.delete(users).run();

  const now = nowIsoString();
  await orm
    .insert(users)
    .values([
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Admin Utama",
        email: "admin@kplayer.local",
        password_hash: hashPassword("Password123!"),
        role: "admin",
        created_at: now,
        updated_at: now,
        deleted_at: null,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Analyst Satu",
        email: "analyst@kplayer.local",
        password_hash: hashPassword("Password123!"),
        role: "analyst",
        created_at: now,
        updated_at: now,
        deleted_at: null,
      },
    ])
    .run();
});

async function loginAndGetToken(email: string, password: string) {
  const request = new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const response = await loginPost(request, EMPTY_CONTEXT);
  const body = await response.json();
  return String(body.data.access_token);
}

describe("Auth + User Management Integration", () => {
  it("login admin lalu akses /me berhasil", async () => {
    const token = await loginAndGetToken("admin@kplayer.local", "Password123!");

    const meRequest = new NextRequest("http://localhost/api/auth/me", {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    });
    const meResponse = await meGet(meRequest, EMPTY_CONTEXT);
    const meBody = await meResponse.json();

    expect(meResponse.status).toBe(200);
    expect(meBody.success).toBe(true);
    expect(meBody.data.user.email).toBe("admin@kplayer.local");
  });

  it("admin bisa create dan list user", async () => {
    const token = await loginAndGetToken("admin@kplayer.local", "Password123!");

    const createRequest = new NextRequest("http://localhost/api/users", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Admin Dua",
        email: "admin2@kplayer.local",
        password: "Password123!",
        role: "admin",
      }),
    });

    const createResponse = await usersPost(createRequest, EMPTY_CONTEXT);
    const createBody = await createResponse.json();
    expect(createResponse.status).toBe(201);
    expect(createBody.success).toBe(true);

    const listRequest = new NextRequest(
      "http://localhost/api/users?page=1&limit=10",
      {
        method: "GET",
        headers: { authorization: `Bearer ${token}` },
      },
    );
    const listResponse = await usersGet(listRequest, EMPTY_CONTEXT);
    const listBody = await listResponse.json();
    expect(listResponse.status).toBe(200);
    expect(listBody.data.items.length).toBeGreaterThanOrEqual(3);
  });

  it("analyst tidak bisa akses list user admin", async () => {
    const token = await loginAndGetToken(
      "analyst@kplayer.local",
      "Password123!",
    );

    const listRequest = new NextRequest("http://localhost/api/users", {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    });
    const listResponse = await usersGet(listRequest, EMPTY_CONTEXT);
    const listBody = await listResponse.json();

    expect(listResponse.status).toBe(403);
    expect(listBody.success).toBe(false);
  });

  it("soft-delete user menghilangkan akses detail user", async () => {
    const token = await loginAndGetToken("admin@kplayer.local", "Password123!");
    const createdUserId = randomUUID();
    const now = nowIsoString();
    await orm
      .insert(users)
      .values({
        id: createdUserId,
        name: "Hapus Saya",
        email: "hapus@kplayer.local",
        password_hash: hashPassword("Password123!"),
        role: "analyst",
        created_at: now,
        updated_at: now,
        deleted_at: null,
      })
      .run();

    const deleteRequest = new NextRequest(
      `http://localhost/api/users/${createdUserId}`,
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      },
    );
    const deleteResponse = await userDelete(deleteRequest, {
      params: Promise.resolve({ id: createdUserId }),
    });
    expect(deleteResponse.status).toBe(200);

    const detailRequest = new NextRequest(
      `http://localhost/api/users/${createdUserId}`,
      {
        method: "GET",
        headers: { authorization: `Bearer ${token}` },
      },
    );
    const detailResponse = await userDetailGet(detailRequest, {
      params: Promise.resolve({ id: createdUserId }),
    });

    expect(detailResponse.status).toBe(404);
  });
});
