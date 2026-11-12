import { EmailClient } from "@azure/communication-email";
import { DefaultAzureCredential } from "@azure/identity";
import { createHash } from "node:crypto";
export function emailReady() {
  return !!(
    (process.env.AZURE_COMMUNICATION_ENDPOINT ||
      process.env.AZURE_COMMUNICATION_CONNECTION_STRING) &&
    process.env.EMAIL_FROM
  );
}
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  key: string,
) {
  if (!emailReady()) throw new Error("Azure email delivery is not configured");
  const client = process.env.AZURE_COMMUNICATION_CONNECTION_STRING
    ? new EmailClient(process.env.AZURE_COMMUNICATION_CONNECTION_STRING)
    : new EmailClient(
        process.env.AZURE_COMMUNICATION_ENDPOINT!,
        new DefaultAzureCredential(),
      );
  const hex = createHash("sha256").update(key).digest("hex");
  const operationId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  const poller = await client.beginSend(
    {
      senderAddress: process.env.EMAIL_FROM!,
      recipients: { to: [{ address: to }] },
      content: { subject, plainText: text },
    },
    { operationId },
  );
  const result = await poller.pollUntilDone({
    abortSignal: AbortSignal.timeout(60000),
  });
  if (result.status !== "Succeeded")
    throw new Error("Azure did not confirm email delivery acceptance");
  return { id: result.id };
}
