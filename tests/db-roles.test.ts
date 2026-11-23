import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";
import { db, inRegion, closeDb, regions } from "../server/db";
import { sendReminders } from "../server/reminders";

// This suite writes synthetic reminders. Refuse every non-fixture database
// before registering either test, including when running a single test by name.
assert.deepEqual(regions, ["eu", "us"]);
for (const region of regions) {
  for (const key of ["DATABASE_URL_", "DATABASE_READER_URL_"]) {
    const url = new URL(process.env[key + region.toUpperCase()]!);
    assert.equal(url.hostname, "127.0.0.1");
    assert.equal(url.pathname, "/petition_" + region);
  }
}

test("regional runtime and reader logins enforce their privileges", async (t) => {
  for (const region of regions) {
    const regionalPool = (key: string) =>
      new Pool({ connectionString: process.env[key + region.toUpperCase()]! });
    const runtime = regionalPool("DATABASE_URL_"),
      reader = regionalPool("DATABASE_READER_URL_");
    t.after(() => Promise.all([runtime.end(), reader.end()]));
    for (const connection of [reader, runtime]) {
      const { rows } =
        await connection.query(`SELECT has_schema_privilege('public','CREATE') AS ddl,
        has_table_privilege('public.users','TRUNCATE') AS truncate, rolcreaterole, rolbypassrls, rolsuper
        FROM pg_roles WHERE rolname=current_user`);
      assert.ok(Object.values(rows[0]).every((value) => value === false));
    }
    for (const name of [
      "users",
      "login_tokens",
      "sessions",
      "stories",
      "profiles",
      "reminder_deliveries",
      "reminder_recipient_deliveries",
      ...(region === "eu" ? ["account_moves"] : []),
    ]) {
      await assert.rejects(
        reader.query(`SELECT * FROM public.${name} LIMIT 0`),
        { code: "42501" },
      );
    }
    for (const view of [
      "rn_signature_groups",
      "rn_published_stories",
      "rn_visa_samples",
    ]) {
      const { rows } = await reader.query(
        "SELECT has_table_privilege($1,'SELECT') AS allowed, has_table_privilege($1,'UPDATE,DELETE,INSERT') AS writable",
        ["public." + view],
      );
      assert.deepEqual(rows[0], { allowed: true, writable: false });
    }
    await assert.rejects(
      runtime.query("DELETE FROM public.profiles WHERE false"),
      { code: "42501" },
    );
  }
});

test("restricted writer runs monthly reminders once per recipient across regions", async () => {
  const now = new Date();
  const stale = new Date(+now - 40 * 86400000);
  const ids = regions.map((r) => "acl-reminder-" + r);
  try {
    for (const [index, r] of regions.entries())
      await inRegion(r, async () => {
        await db.query("INSERT INTO users (id,email) VALUES ($1,$2)", [
          ids[index],
          ids[index] + "@example.test",
        ]);
        const profile = {
          reminders: true,
          cases: [{ events: [{ type: "Filed", date: "2024-01-01" }] }],
        };
        await db.query(
          "INSERT INTO profiles(user_id,data,updated_at) VALUES($1,$2,$3)",
          [ids[index], JSON.stringify(profile), stale],
        );
      });
    const sent: string[] = [];
    const delivery = {
      ready: () => true,
      send: async (to: string) => {
        sent.push(to);
        return { id: "fixture" };
      },
    };
    assert.equal((await sendReminders(now, delivery)).sent, regions.length);
    assert.equal((await sendReminders(now, delivery)).sent, 0);
    assert.deepEqual(sent.sort(), ids.map((id) => id + "@example.test").sort());
  } finally {
    for (const [index, r] of regions.entries())
      await inRegion(r, () =>
        db.query("DELETE FROM users WHERE id=$1", [ids[index]]),
      );
  }
});
test.after(closeDb);
