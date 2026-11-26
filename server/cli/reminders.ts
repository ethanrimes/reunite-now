import { migrate, closeDb, externalSchema } from "../storage/db";
import { sendReminders } from "../jobs/reminders";
if (!externalSchema) await migrate();
console.log(await sendReminders());
await closeDb();
