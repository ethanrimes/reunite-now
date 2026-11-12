import test from "node:test";
import assert from "node:assert/strict";
process.env.TEST_DB = "1";
const { db, migrate, transaction, closeDb } = await import("../server/db");
await migrate();
test("account deletion cascades across profile, story, sessions and reminder ledger", async () => {
  await db.query("INSERT INTO users(id,email) VALUES($1,$2)", [
    "delete-test",
    "delete@example.test",
  ]);
  await db.query("INSERT INTO profiles(user_id,data) VALUES($1,$2)", [
    "delete-test",
    JSON.stringify({ name: "Delete me" }),
  ]);
  await db.query("INSERT INTO stories(user_id,data) VALUES($1,$2)", [
    "delete-test",
    JSON.stringify({ photos: ["test"] }),
  ]);
  await db.query(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
    ["test-token", "delete-test"],
  );
  await db.query(
    "INSERT INTO reminder_deliveries(user_id,period) VALUES($1,$2)",
    ["delete-test", "2026-11"],
  );
  await db.query(
    "INSERT INTO reminder_recipient_deliveries(user_id,period,recipient_key) VALUES($1,$2,$3)",
    ["delete-test", "2026-11", "synthetic-recipient-key"],
  );
  await db.query("DELETE FROM users WHERE id=$1", ["delete-test"]);
  for (const table of [
    "profiles",
    "stories",
    "sessions",
    "reminder_deliveries",
    "reminder_recipient_deliveries",
  ])
    assert.equal(
      (
        await db.query(`SELECT * FROM ${table} WHERE user_id=$1`, [
          "delete-test",
        ])
      ).rows.length,
      0,
    );
});
test("transaction rolls back partial updates", async () => {
  await assert.rejects(
    transaction(async (q) => {
      await q.query("INSERT INTO users(id,email) VALUES($1,$2)", [
        "rollback-test",
        "rollback@example.test",
      ]);
      throw new Error("abort");
    }),
  );
  assert.equal(
    (await db.query("SELECT * FROM users WHERE id=$1", ["rollback-test"])).rows
      .length,
    0,
  );
});
test("unique emails prevent duplicate signatories", async () => {
  await db.query("INSERT INTO users(id,email) VALUES($1,$2)", [
    "unique-1",
    "unique@example.test",
  ]);
  await assert.rejects(
    db.query("INSERT INTO users(id,email) VALUES($1,$2)", [
      "unique-2",
      "unique@example.test",
    ]),
  );
});
test.after(async () => {
  await closeDb();
});
