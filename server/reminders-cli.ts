import { migrate, closeDb } from "./db";
import { sendReminders } from "./reminders";
await migrate();
console.log(await sendReminders());
await closeDb();
