# Operations

For step-by-step Google sign-in, custom domain, sender setup, and delivery testing, see [Finish the integrations](INTEGRATIONS.md).

## Azure resources

Subscription: `9a04b64b-af19-4519-be50-56ec2acbd855`. Tenant: `148ba320-1a6d-4fd7-ba8b-2897083e7531`.

The canonical website runs on `reunite-now-9a04` in North Central US. Its companion App Service is `reunite-now-eu-9a04` in Sweden Central. Both connect over verified TLS to the same two regional account databases. The US server is `reunite-now-pg-9a04` (database `petition_us`) in `reunite-now-rg`. Sweden uses `reunite-now-se-pg-9a04` (database `reunite_now`) in `reunite-now-eu-rg`. Only the Sweden reminder schedule is enabled. Delivery uses the US Communication Service until a separately verified email cutover.

## Regional routing and recovery

Set both `DATABASE_URL_EU` and `DATABASE_URL_US` on each web app. The public hostname uses DNS-only records and a direct App Service ingress. The application uses the platform-overwritten `Client-IP` and a local DB-IP Country Lite lookup. If a reverse proxy is introduced, update and test this trust boundary first. Update the bundled country database periodically. Local single-database development uses PGlite or `DATABASE_URL`.

A new account uses its initial sign-in region. Signed-in requests find the session in its stored region, including legacy sessions. The public endpoints and reminder job read both databases. Incomplete reads fail rather than publishing partial counts. Each region holds a distinct population. An outage of either database can interrupt site functions; neither is a failover replica.

Configuration can transfer the complete active account. An advisory lock shared by both web apps coordinates writes with transfers. Sweden holds a short-lived transfer journal containing the account ID and destination. The destination commits before the source is cleared. A pending transfer resumes before the next routed operation. An error should be retried with the same destination. Investigate sustained failures and restore connectivity before editing any records by hand. Keep both databases and the configuration together when planning a rollback. A single-database release would hide signers from the other region.

## Provisioning and release

Use `infra/main.bicep` and `scripts/provision.py` for infrastructure setup. Keep account credentials and scheduler secrets in App Service settings or a secret store. Restrict server firewalls to both applications’ possible outbound IPs. To rebuild existing infrastructure supply its current credentials. In a disaster restore, compare both regions for each account’s latest home, deletion status, public consent and edits before reopening either database. A stale restore can resurrect an account that was moved or deleted.

Run the build, tests and `scripts/package.py` before ZIP deployment. Deploy the same package to both web apps. Verify the canonical health endpoint, regional settings, account moves, public counts and scheduler state. Health checks query each database. Use `python3 scripts/verify-live.py` for a read-only smoke check.

## Email and reminders

`AZURE_COMMUNICATION_CONNECTION_STRING` and `EMAIL_FROM` configure the verified custom sender `ethan@visatransparencypetition.org`. The custom domain and original Azure-managed domain are both linked to the Communication Service. The code also supports `AZURE_COMMUNICATION_ENDPOINT` plus managed identity if the necessary email-send role is assigned. Tracking is disabled on the email domain. The custom sender has verified ownership, SPF, DKIM, and DKIM2 records in Azure. Cloudflare hosts these records; keep DKIM CNAMEs DNS-only.

The daily job calls `/api/jobs/reminders` with `Bearer CRON_SECRET`. Eligibility is opt-in, at least one active case, and at least 30 days since profile confirmation. An account-level ledger plus `reminder_recipient_deliveries` permits at most one successful send per recipient per account per UTC calendar month. The sign-in email and up to five additional private addresses receive individual messages; normalized duplicates send once. Successful recipient claims commit separately, so a partial failure retries only recipients that have not succeeded. Existing account-level sent records suppress duplicate sends after the migration. Each operation has a deterministic Azure operation ID, so retrying a recent pending send reuses it. Pending sends older than 23 hours are skipped for manual reconciliation rather than risk duplicate delivery. The `sent` and `failed` counters count recipient messages, not accounts. Review the `configured`, `sent`, and `failed` fields in the Logic App HTTP action response; skipped entries are not returned as a separate count. Reconcile old pending ledger entries against Azure delivery status. Do not print message payloads or credentials.

Saving an account or pressing “No changes” confirms all cases. Monthly reminders never modify case timelines. Turn off reminders in the account to unsubscribe. Account deletion cascades through both reminder ledgers. The startup migration creates the new recipient ledger without rewriting the existing account-level delivery records. Recipient operation keys include a hash of the normalized address; primary-address operation keys retain the old format for retry compatibility.

The designated recipient confirmed receipt and successful use of one sign-in email from the custom sender. Azure accepting a message is not itself proof of inbox delivery. A reminder still needs delivery and unattended-run verification with an explicitly authorized test recipient. The scheduler being installed is not evidence of an unattended monthly delivery.

## Google and custom domain

Current canonical origin: `https://visatransparencypetition.org`. Root and `www` have App Service Managed Certificates bound with SNI. The production canonical-host middleware redirects browser GET/HEAD requests while exempting health probes and retaining normal origin checks for writes. After both HTTPS hostnames and the email domain are verified, `python3 scripts/activate-domain.py` applies the URL/sender settings and updates the reminder workflow without sending mail.

Create a Google OAuth web client and configure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in App Service. Authorized redirect URI: `https://visatransparencypetition.org/api/auth/google/callback` (saved per user confirmation). The old Azure callback remains registered for rollback, while production browser requests redirect to the canonical domain. After changing the public hostname, update `APP_URL`, the Google redirect URI, DNS/custom hostname binding, and managed TLS certificate together. The session cookie is secure and same-site in production. Never put OAuth secrets in frontend variables.

## Backups and deletion

The configured PostgreSQL recovery window is seven days. Azure may keep underlying backup files longer to provide that window. Deletion removes the live account and dependent records, including photos and sessions. A point-in-time database restore can resurrect deleted records. Keep the restored site offline; reconcile users against a snapshot of the current live account IDs and remove restored records no longer present before serving requests. If the current database is unavailable, the implementation has no independent deletion ledger: do not expose an older restore until deletions can be reconciled. Deleting a user is intentionally not an audit-retained personal record.

No request body logging or third-party analytics is installed. Avoid enabling request capture containing profiles, addresses, or sign-in tokens. Configure Azure alerts for app health, database storage, and reminder workflow failures as traffic grows.

Run `python3 scripts/verify-live.py` for a read-only API smoke check. Adding `--check-reminders` invokes the real reminder job and can email eligible opted-in users; use it intentionally, not as a read-only check. It prints aggregate results only.

Run `python3 scripts/configure-reminders.py` after initial provisioning and whenever `CRON_SECRET` or `APP_URL` changes. It configures the Consumption Logic App from `infra/reminders.bicep`, with the bearer secret stored as a secure workflow parameter and hidden from run inputs. App Service's WebJob agent remains disabled. See [Microsoft's Logic Apps deployment guide](https://learn.microsoft.com/en-us/azure/logic-apps/quickstart-create-deploy-bicep).

## Handling a privacy request

Ethan Kallett monitors ethan@visatransparencypetition.org, including its spam folder. For account holders, point to Account → Configuration → Delete account or Download data. Someone named in a story or receiving reminders can request help without a login. Ask for the public URL, the item and the requested change. Use proportionate verification and avoid requesting a passport or visa paperwork. Use a tested project sender for replies.

Record the request date, scope, due date and outcome in restricted storage. Where GDPR applies, respond without undue delay and ordinarily within one month. Explain any permitted extension within that first month. For a credible disclosure involving a child or sensitive information, restrict the affected content promptly while checking the request. Verify removal through both the public page and the public API. For unwanted reminders, remove the address from the sending profile. Avoid identifying the account holder to the recipient. Review the inbox, spam, trash and attachments when closing a request. Set and follow a retention period for the minimal case record.

Before reopening a database restore, reconcile account deletions, withdrawn affiliations, removed timelines and unpublished or edited stories through the restore cutoff. A list of surviving account IDs alone cannot reconcile edits. Keep the restored site private if that history cannot be established.

For a suspected disclosure, contain access, preserve minimal evidence and record when the controller became aware. Assess the risk to individuals. When GDPR applies, notify the competent authority within 72 hours where feasible unless the breach is unlikely to pose a risk. Notify affected people without undue delay if the breach creates a high risk, subject to the applicable exceptions. Keep incident records private.
