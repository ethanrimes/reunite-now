import { createHash } from "node:crypto";
import { db, transaction, type Queryable } from "./db";
import { emailReady, sendEmail } from "./email";
import { caseStatus } from "../shared/metrics";
import type { Profile } from "../shared/schema";

export function reminderRecipients(email: string, additional: string[] = []) {
  return [
    ...new Set(
      [email, ...additional].map((value) => value.trim().toLowerCase()),
    ),
  ];
}
const recipientKey = (email: string) =>
  createHash("sha256").update(email).digest("hex");
type Account = { email: string; data: Profile; updated_at: Date | string };
type Claim = { status: string; claimed_at: Date | string };

export async function sendReminders(
  now = new Date(),
  delivery = { ready: emailReady, send: sendEmail },
) {
  if (!delivery.ready()) return { configured: false, sent: 0, failed: 0 };
  const period = now.toISOString().slice(0, 7);
  const cutoff = new Date(+now - 30 * 86400000);
  const eligible = (account?: Account) =>
    account?.data.reminders &&
    +new Date(account.updated_at) <= +cutoff &&
    account.data.cases.some((visa) => caseStatus(visa, now) === "active");
  const stale = (claim: Claim) =>
    +now - +new Date(claim.claimed_at) > 23 * 3600000;
  const account = async (q: Queryable, id: string) =>
    (
      await q.query<Account>(
        `SELECT u.email,p.data,p.updated_at FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.id=$1`,
        [id],
      )
    ).rows[0];
  let sent = 0,
    failed = 0;
  const users = await db.query<{ id: string }>(
    `SELECT user_id AS id FROM profiles WHERE data->>'reminders'='true' AND updated_at <= $1`,
    [cutoff.toISOString()],
  );
  for (const user of users.rows) {
    const initial = await account(db, user.id);
    if (!eligible(initial)) continue;
    await db.query(
      `INSERT INTO reminder_deliveries(user_id,period,claimed_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
      [user.id, period, now.toISOString()],
    );
    const recipients = reminderRecipients(
      initial.email,
      initial.data.reminderEmails,
    );
    for (const recipient of recipients) {
      try {
        const didSend = await transaction(async (q) => {
          // Serialize concurrent workers. Legacy account-level 'sent' records also
          // suppress sends, preserving the monthly limit across this migration.
          const claim = (
            await q.query<Claim>(
              `SELECT status,claimed_at FROM reminder_deliveries WHERE user_id=$1 AND period=$2 FOR UPDATE`,
              [user.id, period],
            )
          ).rows[0];
          if (!claim || claim.status === "sent" || stale(claim)) return false;
          const current = await account(q, user.id);
          if (
            !eligible(current) ||
            !reminderRecipients(
              current.email,
              current.data.reminderEmails,
            ).includes(recipient)
          )
            return false;
          const key = recipientKey(recipient);
          await q.query(
            `INSERT INTO reminder_recipient_deliveries(user_id,period,recipient_key,claimed_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
            [user.id, period, key, now.toISOString()],
          );
          const recipientClaim = (
            await q.query<Claim>(
              `SELECT status,claimed_at FROM reminder_recipient_deliveries WHERE user_id=$1 AND period=$2 AND recipient_key=$3 FOR UPDATE`,
              [user.id, period, key],
            )
          ).rows[0];
          if (recipientClaim.status === "sent" || stale(recipientClaim))
            return false;
          const url = process.env.APP_URL!;
          await delivery.send(
            recipient,
            "Your monthly Reunite Now case check-in",
            `Has anything changed in your visa process?\n\nVisit ${url}/account to add a milestone and its date, or confirm that nothing has changed. A confirmation updates the case's last-checked timestamp, not its original event dates.\n\nThis address was selected for monthly reminders in a Reunite Now account. The account owner can turn reminders off or remove additional addresses in Account. We never include applicant names, case details, documents, or other recipients' addresses in reminder emails.\n\nReunite Now`,
            // Retain the old operation ID for the primary address on upgrades.
            recipient === current.email.trim().toLowerCase()
              ? `reminder/${user.id}/${period}`
              : `reminder/${user.id}/${period}/${key}`,
          );
          await q.query(
            `UPDATE reminder_recipient_deliveries SET status='sent',sent_at=$4 WHERE user_id=$1 AND period=$2 AND recipient_key=$3`,
            [user.id, period, key, now.toISOString()],
          );
          return true;
        });
        if (didSend) sent++;
      } catch {
        // A failed recipient must not roll back or resend successful recipients.
        failed++;
      }
    }
    await transaction(async (q) => {
      const claim = (
        await q.query<Claim>(
          `SELECT status,claimed_at FROM reminder_deliveries WHERE user_id=$1 AND period=$2 FOR UPDATE`,
          [user.id, period],
        )
      ).rows[0];
      if (!claim || claim.status === "sent") return;
      const current = await account(q, user.id);
      if (!eligible(current)) return;
      const delivered = await q.query<{ recipient_key: string }>(
        `SELECT recipient_key FROM reminder_recipient_deliveries WHERE user_id=$1 AND period=$2 AND status='sent'`,
        [user.id, period],
      );
      const keys = new Set(delivered.rows.map((row) => row.recipient_key));
      if (
        reminderRecipients(current.email, current.data.reminderEmails).every(
          (email) => keys.has(recipientKey(email)),
        )
      )
        await q.query(
          `UPDATE reminder_deliveries SET status='sent',sent_at=$3 WHERE user_id=$1 AND period=$2`,
          [user.id, period, now.toISOString()],
        );
    });
  }
  return { configured: true, sent, failed };
}
