import { Pool } from "pg";
import type { PGlite } from "@electric-sql/pglite";
import { mkdirSync } from "node:fs";
export type Queryable = {
  query: <T = Record<string, any>>(
    sql: string,
    params?: any[],
  ) => Promise<{ rows: T[]; rowCount?: number | null }>;
};
let lite: PGlite | undefined;
if (!process.env.DATABASE_URL) {
  if (process.env.NODE_ENV === "production")
    throw new Error("DATABASE_URL is required in production");
  const { PGlite } = await import("@electric-sql/pglite");
  mkdirSync(".local", { recursive: true });
  lite = new PGlite(
    process.env.TEST_DB === "1" ? "memory://" : ".local/postgres",
  );
}
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      ssl:
        process.env.DB_SSL === "true"
          ? { rejectUnauthorized: true }
          : undefined,
    })
  : undefined;
export const db: Queryable = pool
  ? {
      query: async (sql, params) => {
        const r = await pool.query(sql, params);
        return { rows: r.rows as any[], rowCount: r.rowCount };
      },
    }
  : {
      query: async (sql, params) => {
        const r = await lite!.query(sql, params);
        return { rows: r.rows as any[], rowCount: r.affectedRows };
      },
    };
export async function transaction<T>(
  fn: (q: Queryable) => Promise<T>,
): Promise<T> {
  if (lite)
    return lite.transaction(async (tx) =>
      fn({
        query: async (sql, params) => {
          const r = await tx.query(sql, params);
          return { rows: r.rows as any[], rowCount: r.affectedRows };
        },
      }),
    );
  const client = await pool!.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export async function closeDb() {
  if (pool) await pool.end();
  if (lite) await lite.close();
}
export async function migrate() {
  for (const sql of [
    `CREATE TABLE IF NOT EXISTS users (id text PRIMARY KEY,email text NOT NULL UNIQUE,created_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS sessions (token_hash text PRIMARY KEY,user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS login_tokens (token_hash text PRIMARY KEY,email text NOT NULL,expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS profiles (user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,data jsonb NOT NULL,signed_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),consent_version text NOT NULL DEFAULT '2026-11-11')`,
    `CREATE TABLE IF NOT EXISTS stories (user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,data jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS reminder_deliveries (user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,period text NOT NULL,status text NOT NULL DEFAULT 'pending',claimed_at timestamptz NOT NULL DEFAULT now(),sent_at timestamptz,PRIMARY KEY(user_id,period))`,
    `CREATE TABLE IF NOT EXISTS reminder_recipient_deliveries (user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,period text NOT NULL,recipient_key text NOT NULL,status text NOT NULL DEFAULT 'pending',claimed_at timestamptz NOT NULL DEFAULT now(),sent_at timestamptz,PRIMARY KEY(user_id,period,recipient_key))`,
    `CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id)`,
    `CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at)`,
  ])
    await db.query(sql);
}
