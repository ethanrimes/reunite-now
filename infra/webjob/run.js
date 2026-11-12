// Azure App Service scheduled WebJob, daily at 16:00 UTC.
// The API owns eligibility, consent, locking and monthly deduplication.
(async () => {
  const { APP_URL, CRON_SECRET } = process.env;
  if (!APP_URL || !CRON_SECRET)
    throw new Error("Missing reminder job configuration");
  const r = await fetch(`${APP_URL}/api/jobs/reminders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
    signal: AbortSignal.timeout(240000),
  });
  if (!r.ok) throw new Error(`Reminder job failed: HTTP ${r.status}`);
  const result = await r.json();
  console.log(JSON.stringify(result));
  if (result.failed) process.exitCode = 1;
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
