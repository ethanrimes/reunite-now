import test from "node:test";
import assert from "node:assert/strict";
import { profileSchema } from "../shared/schema";
process.env.TEST_DB = "1";
delete process.env.DATABASE_URL;
process.env.APP_URL = "https://visatransparency.org";
const { db, migrate, closeDb } = await import("../server/db");
const { sendReminders } = await import("../server/reminders");
await migrate();
const now = new Date("2026-11-11T12:00:00Z");
const baseProfile = {
  name: "Synthetic reminder test",
  legalStatus: "Other",
  country: "Colombia",
  city: "Bogotá",
  personallyInvolved: true,
  signed: true,
  publicConsent: true,
  adultConsent: true,
  reminders: true,
  cases: [
    {
      id: "test-case",
      applicantName: "Private applicant",
      relationship: "Self",
      country: "Colombia",
      category: "CR-1",
      post: "Bogotá",
      events: [
        {
          id: "filed",
          type: "Filed",
          date: "2026-01-01",
          note: "Private timeline note",
        },
      ],
    },
  ],
};
async function owner(
  id: string,
  changes: Record<string, unknown> = {},
  days = 31,
) {
  const profile = profileSchema.parse({ ...baseProfile, ...changes });
  await db.query(`INSERT INTO users(id,email) VALUES($1,$2)`, [
    id,
    `${id}@example.test`,
  ]);
  await db.query(
    `INSERT INTO profiles(user_id,data,updated_at) VALUES($1,$2,$3)`,
    [
      id,
      JSON.stringify(profile),
      new Date(+now - days * 86400000).toISOString(),
    ],
  );
  return profile;
}
function recorder(fail?: string) {
  const attempts: { to: string; text: string; key: string }[] = [];
  let failing = fail;
  return {
    attempts,
    delivery: {
      ready: () => true,
      send: async (to: string, _subject: string, text: string, key: string) => {
        attempts.push({ to, text, key });
        if (to === failing) {
          failing = undefined;
          throw new Error("Synthetic send failure");
        }
        return { id: key };
      },
    },
  };
}
test.beforeEach(async () => {
  await db.query("DELETE FROM users");
});
test.after(closeDb);

test("recipient validation supports old profiles, normalization, limits, and invalid addresses", () => {
  assert.deepEqual(profileSchema.parse(baseProfile).reminderEmails, []);
  assert.deepEqual(
    profileSchema.parse({
      ...baseProfile,
      reminderEmails: [" BACKUP@EXAMPLE.TEST ", "backup@example.test"],
    }).reminderEmails,
    ["backup@example.test"],
  );
  assert.equal(
    profileSchema.safeParse({
      ...baseProfile,
      reminderEmails: ["not an address"],
    }).success,
    false,
  );
  assert.equal(
    profileSchema.safeParse({
      ...baseProfile,
      reminderEmails: Array.from(
        { length: 6 },
        (_, i) => `extra${i}@example.test`,
      ),
    }).success,
    false,
  );
});
test("monthly reminders deduplicate recipients and keep every message private", async () => {
  await owner("owner", {
    reminderEmails: [
      "OWNER@example.test",
      "one@example.test",
      " TWO@example.test ",
      "one@example.test",
    ],
  });
  const { attempts, delivery } = recorder();
  assert.deepEqual(await sendReminders(now, delivery), {
    configured: true,
    sent: 3,
    failed: 0,
  });
  assert.deepEqual(
    attempts.map((item) => item.to),
    ["owner@example.test", "one@example.test", "two@example.test"],
  );
  assert.equal(
    attempts[0].key,
    "reminder/owner/2026-11",
    "primary operation IDs remain compatible with the old worker",
  );
  for (const item of attempts) {
    assert.ok(item.text.includes("https://visatransparency.org/account"));
    for (const privateValue of [
      "Private applicant",
      "Private timeline note",
      "owner@example.test",
      "one@example.test",
      "two@example.test",
    ])
      assert.equal(item.text.includes(privateValue), false);
  }
  assert.deepEqual(await sendReminders(now, delivery), {
    configured: true,
    sent: 0,
    failed: 0,
  });
  assert.equal(
    (
      await db.query(
        "SELECT * FROM reminder_recipient_deliveries WHERE status='sent'",
      )
    ).rows.length,
    3,
  );
  assert.equal(
    (await sendReminders(new Date("2026-12-11T12:00:00Z"), delivery)).sent,
    3,
  );
  assert.equal(new Set(attempts.map((item) => item.key)).size, 6);
});
test("partial failures retry only the failed recipient", async () => {
  await owner("owner", {
    reminderEmails: ["fails@example.test", "success@example.test"],
  });
  const { attempts, delivery } = recorder("fails@example.test");
  assert.deepEqual(await sendReminders(now, delivery), {
    configured: true,
    sent: 2,
    failed: 1,
  });
  assert.equal(
    (await db.query("SELECT status FROM reminder_deliveries")).rows[0].status,
    "pending",
  );
  assert.deepEqual(await sendReminders(now, delivery), {
    configured: true,
    sent: 1,
    failed: 0,
  });
  assert.deepEqual(
    attempts.map((item) => item.to),
    [
      "owner@example.test",
      "fails@example.test",
      "success@example.test",
      "fails@example.test",
    ],
  );
  assert.equal(attempts[1].key, attempts[3].key);
  assert.equal(
    (await db.query("SELECT status FROM reminder_deliveries")).rows[0].status,
    "sent",
  );
});
test("legacy sent claims and old uncertain claims do not resend", async () => {
  await owner("owner", { reminderEmails: ["extra@example.test"] });
  const { attempts, delivery } = recorder();
  await db.query(
    "INSERT INTO reminder_deliveries(user_id,period,status,claimed_at) VALUES($1,$2,'sent',$3)",
    ["owner", "2026-11", now.toISOString()],
  );
  assert.equal((await sendReminders(now, delivery)).sent, 0);
  await db.query(
    "UPDATE reminder_deliveries SET status='pending',claimed_at=$1",
    [new Date(+now - 24 * 3600000).toISOString()],
  );
  assert.equal((await sendReminders(now, delivery)).sent, 0);
  assert.equal(attempts.length, 0);
});
test("opt-out, recent confirmation, and closed cases suppress all recipients", async () => {
  await owner("opt-out", {
    reminders: false,
    reminderEmails: ["extra@example.test"],
  });
  await owner("recent", {}, 29);
  await owner("closed", {
    cases: [
      {
        ...baseProfile.cases[0],
        events: [
          ...baseProfile.cases[0].events,
          { id: "approved", type: "Approved", date: "2026-02-01", note: "" },
        ],
      },
    ],
  });
  const { attempts, delivery } = recorder();
  assert.equal((await sendReminders(now, delivery)).sent, 0);
  assert.equal(attempts.length, 0);
});
test("removing an address or opting out suppresses pending retries", async () => {
  const profile = await owner("owner", {
    reminderEmails: ["removed@example.test"],
  });
  const { attempts, delivery } = recorder("removed@example.test");
  await sendReminders(now, delivery);
  await db.query("UPDATE profiles SET data=$1 WHERE user_id='owner'", [
    JSON.stringify({ ...profile, reminderEmails: [] }),
  ]);
  assert.equal((await sendReminders(now, delivery)).sent, 0);
  assert.equal(attempts.length, 2);
  await db.query("UPDATE profiles SET data=$1 WHERE user_id='owner'", [
    JSON.stringify({ ...profile, reminders: false }),
  ]);
  assert.equal((await sendReminders(now, delivery)).sent, 0);
  assert.equal(attempts.length, 2);
});
test("overlapping workers send once per recipient", async () => {
  await owner("owner", { reminderEmails: ["extra@example.test"] });
  const { attempts, delivery } = recorder();
  const results = await Promise.all([
    sendReminders(now, delivery),
    sendReminders(now, delivery),
  ]);
  assert.equal(
    results.reduce((total, result) => total + result.sent, 0),
    2,
  );
  assert.equal(attempts.length, 2);
});
