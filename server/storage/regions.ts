import { createHash } from "node:crypto";
import type { QueryResult } from "pg";
import {
  coordinator,
  db,
  dual,
  inRegion,
  region,
  regions,
  transaction,
  type Region,
} from "./db";

export const acrossRegions = <T>(fn: () => Promise<T>) =>
  Promise.all(regions.map((r) => inRegion(r, fn)));

export async function locate(
  sql: string,
  params: unknown[],
): Promise<Region | undefined> {
  const found = await acrossRegions(
    async () => (await db.query(sql, params)).rows.length > 0,
  );
  if (found.filter(Boolean).length > 1)
    throw new Error("Conflicting regional identity");
  return regions.find((_, i) => found[i]);
}
export async function homeForEmail(email: string, fallback: Region) {
  if (!dual) return region();
  const fingerprint = createHash("sha256").update(email).digest("hex");
  return (
    (await locate(
      "SELECT 1 FROM users WHERE sha256(convert_to(email,'UTF8'))=decode($1,'hex')",
      [fingerprint],
    )) ?? fallback
  );
}

const accountTables = [
  ["users", "id"],
  ["oauth_identities", "user_id"],
  ["profiles", "user_id"],
  ["stories", "user_id"],
  ["sessions", "user_id"],
  ["reminder_deliveries", "user_id"],
  ["reminder_recipient_deliveries", "user_id"],
  ["login_tokens", "email"],
] as const;

// A committed destination always precedes source deletion. The EU journal contains
// only an account ID and destination. Replaying a pending move is idempotent.
async function finishMove(id: string, destination: Region) {
  const source = destination === "eu" ? "us" : "eu";
  await inRegion(source, () =>
    transaction(async (src) => {
      const user = (
        await src.query("SELECT email FROM users WHERE id=$1 FOR UPDATE", [id])
      ).rows[0];
      if (!user) {
        const present = await inRegion(destination, () =>
          db.query("SELECT 1 FROM users WHERE id=$1", [id]),
        );
        if (!present.rows.length) throw new Error("Transfer requires recovery");
        return;
      }
      await inRegion(destination, () =>
        transaction(async (dst) => {
          await dst.query("DELETE FROM users WHERE id=$1", [id]);
          await dst.query("DELETE FROM login_tokens WHERE email=$1", [
            user.email,
          ]);
          for (const [table, key] of accountTables) {
            const value = key === "email" ? user.email : id;
            // PostgreSQL serializes complete rows, preserving timestamp precision and JSON.
            const payload = (
              await src.query(
                `SELECT coalesce(jsonb_agg(t),'[]'::jsonb)::text AS batch FROM ${table} t WHERE ${key}=$1`,
                [value],
              )
            ).rows[0].batch;
            const inserted = await dst.query(
              `INSERT INTO ${table} SELECT * FROM jsonb_populate_recordset(NULL::${table},$1::jsonb)`,
              [payload],
            );
            if (inserted.rowCount !== JSON.parse(payload).length)
              throw new Error("Incomplete regional transfer");
          }
        }),
      );
      await src.query("DELETE FROM login_tokens WHERE email=$1", [user.email]);
      await src.query("DELETE FROM users WHERE id=$1", [id]);
    }),
  );
  await inRegion("eu", () =>
    db.query("DELETE FROM account_moves WHERE user_id=$1", [id]),
  );
}

// All application instances share this PostgreSQL lock. Reads and ordinary writes
// run together. A move excludes them until the destination is the only live copy.
export async function routed<T>(
  exclusive: boolean,
  fn: () => Promise<T>,
): Promise<T> {
  if (!coordinator) return fn();
  for (;;) {
    const client = await coordinator.connect();
    let pending = false;
    let discard = false;
    try {
      const lock = exclusive
        ? "pg_advisory_xact_lock"
        : "pg_advisory_xact_lock_shared";
      // Send separate statements in one PostgreSQL message. At READ COMMITTED
      // the journal query gets its snapshot after the preceding lock is acquired.
      const results = await client.query<{
        user_id: string;
        destination: Region;
      }>(
        `BEGIN ISOLATION LEVEL READ COMMITTED;
         SELECT ${lock}(721590112);
         SELECT user_id,destination FROM account_moves`,
      );
      // pg returns one result per statement for a multi-statement simple query.
      const [, , journal] = results as unknown as QueryResult<{
        user_id: string;
        destination: Region;
      }>[];
      const moves = journal.rows;
      pending = moves.length > 0 && !exclusive;
      if (!pending) {
        for (const move of moves)
          await finishMove(move.user_id, move.destination);
        const result = await fn();
        await client.query("COMMIT");
        return result;
      }
      await client.query("ROLLBACK");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {
        discard = true;
      });
      throw error;
    } finally {
      client.release(discard);
    }
    if (pending) await routed(true, async () => {});
  }
}

// Caller holds the exclusive routing lock.
export async function moveAccount(id: string, destination: Region) {
  if (!dual)
    throw Object.assign(new Error("Regional storage is unavailable."), {
      status: 503,
    });
  if (destination === region()) return;
  await inRegion("eu", () =>
    db.query("INSERT INTO account_moves(user_id,destination) VALUES($1,$2)", [
      id,
      destination,
    ]),
  );
  await finishMove(id, destination);
}
