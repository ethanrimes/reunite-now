import {
  closeDb,
  dual,
  externalSchema,
  inRegion,
  migrate,
  regions,
  transaction,
} from "./db";
import { acrossRegions, routed } from "./regions";
import { cleanHistoricalStoryPhotos } from "./story-photos";

try {
  if (externalSchema)
    throw new Error(
      "Use release credentials in a separate process without reader URLs",
    );
  const grant = process.argv.slice(2);
  if (
    grant.length &&
    !(grant.length === 1 && grant[0] === "--grant-app-roles" && dual)
  )
    throw new Error(
      "Usage: db:migrate [--grant-app-roles]. Granting requires two regional databases",
    );
  await migrate();
  if (grant.length) {
    for (const r of regions)
      await inRegion(r, () =>
        transaction(async (q) => {
          // Both roles are provisioned by an administrator. Grant on named objects
          // so adding a future table does not automatically expose it.
          await q.query(
            "GRANT USAGE ON SCHEMA public TO rn_runtime, rn_reader",
          );
          await q.query(
            "GRANT SELECT ON public.rn_signature_groups, public.rn_visa_samples, public.rn_published_stories TO rn_reader",
          );
          await q.query(
            "GRANT SELECT, INSERT ON public.users, public.sessions, public.login_tokens, public.profiles, public.stories, public.reminder_deliveries, public.reminder_recipient_deliveries TO rn_runtime",
          );
          await q.query(
            "GRANT DELETE ON public.users, public.sessions, public.login_tokens, public.stories TO rn_runtime",
          );
          await q.query("GRANT UPDATE (email) ON public.users TO rn_runtime");
          await q.query(
            "GRANT UPDATE (data, updated_at) ON public.profiles, public.stories TO rn_runtime",
          );
          for (const table of [
            "reminder_deliveries",
            "reminder_recipient_deliveries",
          ]) {
            await q.query(
              `GRANT UPDATE (status, sent_at) ON public.${table} TO rn_runtime`,
            );
          }
          if (r === "eu")
            await q.query(
              "GRANT SELECT, INSERT, DELETE ON public.account_moves TO rn_runtime",
            );
        }),
      );
  }
  await routed(false, () => acrossRegions(cleanHistoricalStoryPhotos));
  console.log("Database migration complete");
} finally {
  await closeDb();
}
