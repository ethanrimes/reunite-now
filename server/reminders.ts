import { db, transaction } from "./db";
import { emailReady, sendEmail } from "./email";
import { caseStatus } from "../shared/metrics";
import type { Profile } from "../shared/schema";
export async function sendReminders(now = new Date()) {
  if (!emailReady()) return { configured: false, sent: 0, failed: 0 };
  const period = now.toISOString().slice(0, 7);
  let sent = 0,
    failed = 0;
  const users = await db.query<{ id: string; email: string; data: Profile }>(
    `SELECT u.id,u.email,p.data FROM users u JOIN profiles p ON p.user_id=u.id WHERE p.data->>'reminders'='true' AND p.updated_at <= now()-interval '30 days'`,
  );
  for (const user of users.rows) {
    if (!user.data.cases.some((c) => caseStatus(c, now) === "active")) continue;
    try {
      await db.query(
        `INSERT INTO reminder_deliveries(user_id,period) VALUES($1,$2) ON CONFLICT DO NOTHING`,
        [user.id, period],
      );
      await transaction(async (q) => {
        // Durable monthly claim plus row lock prevents overlapping workers. Azure receives
        // the same deterministic operation ID on a same-day retry. Older uncertain sends
        // require manual reconciliation instead of risking a duplicate reminder.
        const claim = await q.query<{ status: string; claimed_at: Date }>(
          `SELECT status,claimed_at FROM reminder_deliveries WHERE user_id=$1 AND period=$2 FOR UPDATE`,
          [user.id, period],
        );
        if (claim.rows[0].status === "sent") return;
        if (+now - new Date(claim.rows[0].claimed_at).getTime() > 23 * 3600000)
          return;
        const still = await q.query<{ data: Profile }>(
          `SELECT data FROM profiles WHERE user_id=$1`,
          [user.id],
        );
        if (!still.rows[0]?.data.reminders) return;
        const url = process.env.APP_URL!;
        await sendEmail(
          user.email,
          "Your monthly Reunite Now case check-in",
          `Has anything changed in your visa process?\n\nVisit ${url}/account to add a milestone and its date, or confirm that nothing has changed. A confirmation updates the case's last-checked timestamp, not its original event dates.\n\nYou opted into one monthly reminder for active cases. Turn reminders off anytime in Account. We never include applicant names, case details, or documents in reminder emails.\n\nReunite Now`,
          `reminder/${user.id}/${period}`,
        );
        await q.query(
          `UPDATE reminder_deliveries SET status='sent',sent_at=now() WHERE user_id=$1 AND period=$2`,
          [user.id, period],
        );
        sent++;
      });
    } catch {
      failed++;
    }
  }
  return { configured: true, sent, failed };
}
