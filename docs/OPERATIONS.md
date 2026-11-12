# Operations

## Azure resources

Subscription: `9a04b64b-af19-4519-be50-56ec2acbd855`. Tenant: `148ba320-1a6d-4fd7-ba8b-2897083e7531`.

All resources are isolated in `reunite-now-rg`:

| Resource                    | Purpose                                                      |
| --------------------------- | ------------------------------------------------------------ |
| `reunite-now-plan`          | Linux B1 App Service plan; always on for scheduled jobs      |
| `reunite-now-9a04`          | React static assets and Express API, Node 24                 |
| `reunite-now-pg-9a04`       | PostgreSQL 16, Burstable B1ms, 32 GB, database `reunite_now` |
| `reunite-now-communication` | Azure Communication Services                                 |
| `reunite-now-email`         | Email service and verified Azure-managed sender domain       |

App Service and PostgreSQL have ongoing compute charges even with no visitors. Email is metered. This avoids separate worker hosting and keeps the initial operational setup small. Review actual costs in Azure Cost Management; no monthly price is guaranteed here. The B1 database is not highly available.

## Provisioning

`infra/main.bicep` describes the app and database. `infra/firewall.bicep` restricts database access to the app's possible outbound IPs; there is no allow-all-Azure rule. `infra/email.bicep` creates and links the email domain. TLS certificate verification is enabled for database connections.

`scripts/provision.py` targets this subscription and resource group explicitly. It creates a protected temporary password file for provisioning and removes it after storing app configuration. **Running provisioning again rotates the database password and reminder secret.** Use it for initial infrastructure setup or a planned rotation, not normal application releases. `--resume` is only for a failed initial run while `.local/provision-parameters.json` still exists. Do not start concurrent provisioning runs.

Deploy email infrastructure after the main template, then run `python3 scripts/configure-email.py`. Reapplying the main template may require relinking the email domain. Secrets are passed in protected temporary files and never printed. Access to App Service settings must remain restricted.

## Releases

Run build, unit/storage tests, and the local API integration test. Package with `python3 scripts/package.py`, then zip-deploy using the command in README. The archive includes a self-contained server bundle and a scheduled WebJob. No database files or `.env` files are included. Keep the previous deployment ZIP privately if rollback is needed. Use Git commit IDs to identify releases.

After deployment verify:

- `/api/health` returns success after a real database query.
- `/api/config` reports production sign-in availability and no development bypass.
- `/api/public` contains no email, session, or reminder preferences.
- Home, account login, maps, story gallery, and deep links load over HTTPS.
- The `monthly-reminders` triggered WebJob is present with schedule `0 0 16 * * *` (16:00 UTC daily).

## Email and reminders

`AZURE_COMMUNICATION_CONNECTION_STRING` and `EMAIL_FROM` configure the current Azure-managed sender. The code also supports `AZURE_COMMUNICATION_ENDPOINT` plus managed identity if the necessary email-send role is assigned. Tracking is disabled on the email domain. A custom sender domain later needs DNS verification, SPF, and DKIM in Azure.

The daily job calls `/api/jobs/reminders` with `Bearer CRON_SECRET`. Eligibility is opt-in, at least one active case, and at least 30 days since profile confirmation. A database ledger permits at most one send per calendar month. Each operation has a deterministic Azure operation ID, so retrying a recent pending send reuses it. Pending sends older than 23 hours are skipped for manual reconciliation rather than risk duplicate delivery. Review failed/skipped counts in job logs; do not print message payloads or credentials.

Saving an account or pressing “No changes” confirms all cases. Monthly reminders never modify case timelines. Turn off reminders in the account to unsubscribe. Account deletion cascades through the reminder ledger.

Azure accepting a message is not proof of inbox delivery. Verify a sign-in email and reminder with an explicitly authorized test recipient before announcing email availability to a large audience. The scheduler being installed is not evidence of an unattended monthly delivery.

## Google and custom domain

Create a Google OAuth web client and configure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in App Service. Authorized redirect URI: `https://reunite-now-9a04.azurewebsites.net/api/auth/google/callback`. After changing the public hostname, update `APP_URL`, the Google redirect URI, DNS/custom hostname binding, and managed TLS certificate together. The session cookie is secure and same-site in production. Never put OAuth secrets in frontend variables.

## Backups and deletion

PostgreSQL backups retain up to seven days. Deletion removes the live account and dependent records, including photos and sessions. A point-in-time database restore can resurrect deleted records. Keep the restored site offline; reconcile users against a snapshot of the current live account IDs and remove restored records no longer present before serving requests. If the current database is unavailable, the implementation has no independent deletion ledger: do not expose an older restore until deletions can be reconciled. Deleting a user is intentionally not an audit-retained personal record.

No request body logging or third-party analytics is installed. Avoid enabling request capture containing profiles, addresses, or sign-in tokens. Configure Azure alerts for app health, database storage, and WebJob failures as traffic grows.

Run `python3 scripts/verify-live.py` for a read-only API smoke check. Adding `--check-reminders` invokes the real reminder job and can email eligible opted-in users; use it intentionally, not as a read-only check. It prints aggregate results only.
