import { migrate, closeDb, externalSchema } from "./db";
import { sendReminders } from "./reminders";
if (!externalSchema) await migrate();
console.log(await sendReminders());
await closeDb();
