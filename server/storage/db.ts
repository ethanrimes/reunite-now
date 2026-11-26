import { AsyncLocalStorage } from "node:async_hooks";
import { publicViews } from "./public-schema";
import { Pool } from "pg";
import type { PGlite } from "@electric-sql/pglite";
import { mkdirSync } from "node:fs";
export type Queryable = {
  query: <T = Record<string, any>>(
    sql: string,
    params?: any[],
  ) => Promise<{ rows: T[]; rowCount?: number | null }>;
};
export type Region = "eu" | "us";
const scoped = new AsyncLocalStorage<Region>();
export const inRegion = <T>(region: Region, fn: () => T) =>
  scoped.run(region, fn);
export const region = (): Region => scoped.getStore() ?? "eu";
const eu = process.env.DATABASE_URL_EU,
  us = process.env.DATABASE_URL_US;
export const dual = Boolean(eu && us);
if (
  !!eu !== !!us ||
  (eu &&
    us &&
    new URL(eu).host + new URL(eu).pathname ===
      new URL(us).host + new URL(us).pathname)
)
  throw new Error("Provide two distinct regional database URLs");
if (process.env.NODE_ENV === "production" && !dual)
  throw new Error("Both regional database URLs are required in production");
export const regions: Region[] = dual ? ["eu", "us"] : ["eu"];
const options = {
  max: 6,
  connectionTimeoutMillis: 10000,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
};
const primary = eu || process.env.DATABASE_URL;
const readerUrls = {
  eu: process.env.DATABASE_READER_URL_EU,
  us: process.env.DATABASE_READER_URL_US,
};
export const externalSchema = Boolean(readerUrls.eu || readerUrls.us);
if (externalSchema) {
  for (const r of ["eu", "us"] as const) {
    const writer = r === "eu" ? eu : us;
    if (!writer || !readerUrls[r])
      throw new Error(
        "Both regional reader and runtime connections are required",
      );
    const a = new URL(writer),
      b = new URL(readerUrls[r]!);
    if (
      a.host !== b.host ||
      a.pathname !== b.pathname ||
      a.username === b.username
    )
      throw new Error(
        "Each reader must use its regional database and a distinct login",
      );
  }
}
const pools = {
  eu: primary
    ? new Pool({
        ...options,
        max: externalSchema ? 4 : 6,
        connectionString: primary,
      })
    : null,
  us: us
    ? new Pool({
        ...options,
        max: externalSchema ? 4 : 6,
        connectionString: us,
      })
    : null,
};
const readerPools = {
  eu: readerUrls.eu
    ? new Pool({ ...options, max: 2, connectionString: readerUrls.eu })
    : null,
  us: readerUrls.us
    ? new Pool({ ...options, max: 2, connectionString: readerUrls.us })
    : null,
};
// Dedicated connections avoid exhausting a region's query pool with callers waiting for a move.
export const coordinator = dual
  ? new Pool({ ...options, max: 4, connectionString: eu })
  : null;
for (const pool of [
  coordinator,
  ...Object.values(pools),
  ...Object.values(readerPools),
])
  pool?.on("error", () => console.error("Idle database connection closed"));
let lite: PGlite | undefined;
if (!primary) {
  const { PGlite } = await import("@electric-sql/pglite");
  mkdirSync(".local", { recursive: true });
  lite = new PGlite(
    process.env.TEST_DB === "1" ? "memory://" : ".local/postgres",
  );
}
export const db: Queryable = {
  query: async (sql, params) => {
    const pool = pools[region()];
    if (pool) {
      const r = await pool.query(sql, params);
      return { rows: r.rows, rowCount: r.rowCount };
    }
    const r = await lite!.query(sql, params);
    return { rows: r.rows as any[], rowCount: r.affectedRows };
  },
};
export const publicDb: Queryable = {
  query: async (sql, params) => {
    const reader = readerPools[region()];
    if (!reader) return db.query(sql, params);
    const result = await reader.query(sql, params);
    return { rows: result.rows, rowCount: result.rowCount };
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
  const client = await pools[region()]!.connect();
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
  await Promise.all(
    [coordinator, ...Object.values(pools), ...Object.values(readerPools)].map(
      (p) => p?.end(),
    ),
  );
  if (lite) await lite.close();
}
export async function migrate() {
  for (const r of regions)
    await inRegion(r, () =>
      transaction(async (q) => {
        if (pools[r]) await q.query("SELECT pg_advisory_xact_lock(721590113)");
        await migrateRegionalSchema(q);
        if (dual && r === "eu")
          await q.query(
            "CREATE TABLE IF NOT EXISTS account_moves (user_id text PRIMARY KEY, destination text NOT NULL CHECK (destination IN ('eu','us')))",
          );
      }),
    );
}
async function migrateRegionalSchema(q: Queryable) {
  for (const sql of [
    `CREATE TABLE IF NOT EXISTS users (id text PRIMARY KEY,email text UNIQUE,created_at timestamptz NOT NULL DEFAULT now())`,
    `ALTER TABLE users ALTER COLUMN email DROP NOT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS microsoft_email text`,
    `CREATE TABLE IF NOT EXISTS oauth_identities (identity_key text PRIMARY KEY,user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS sessions (token_hash text PRIMARY KEY,user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS login_tokens (token_hash text PRIMARY KEY,email text NOT NULL,expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS profiles (user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,data jsonb NOT NULL,signed_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),consent_version text NOT NULL DEFAULT '2026-11-11')`,
    `UPDATE profiles SET data = data - 'city' WHERE data ? 'city'`,
    `CREATE TABLE IF NOT EXISTS stories (user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,data jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS reminder_deliveries (user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,period text NOT NULL,status text NOT NULL DEFAULT 'pending',claimed_at timestamptz NOT NULL DEFAULT now(),sent_at timestamptz,PRIMARY KEY(user_id,period))`,
    `CREATE TABLE IF NOT EXISTS reminder_recipient_deliveries (user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,period text NOT NULL,recipient_key text NOT NULL,status text NOT NULL DEFAULT 'pending',claimed_at timestamptz NOT NULL DEFAULT now(),sent_at timestamptz,PRIMARY KEY(user_id,period,recipient_key))`,
    `CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id)`,
    `CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at)`,
    `CREATE INDEX IF NOT EXISTS profiles_listed_signatures ON profiles(signed_at DESC)
     WHERE data->>'signed'='true' AND data->>'publicConsent'='true' AND data->'listSignature'='true'::jsonb`,
    ...publicViews,
  ])
    await q.query(sql);
}
