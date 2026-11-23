# Architecture

Reunite Now serves a React application and an Express API from the same origin. The petition uses two PostgreSQL databases. Reference maps, legislation and editorial content ship with the application. Visitors can read these without an account.

## Follow a request

1. Vite builds the browser entry point in `client/src/main.tsx`. React Router selects the page. The account and map routes load their code on demand. The Express server serves the built files and supports direct links to nested routes.
2. The client requests the data its route displays. For example, the gallery requests a page of story cards with small covers. Opening a story requests its text and inline photos together. Coverage requests grouped counts. The visa dashboard requests statistics for the selected filters.
3. Express validates input, resolves the signed-in session for private operations and runs parameterized queries using the regional pool. Public queries select consented records in both regions. Regional results are combined before responding. A failed regional read fails the request so an incomplete count cannot look like the full count.
4. The read-only preview under `/demo` serves synthetic data generated in memory. It bypasses live account reads and editing. Local developers can separately enable sample data with `npm run dev:demo`.

| Where to work | Responsibility |
| --- | --- |
| `client/src/app/` and `main.tsx` | API access, data context, preview detection, navigation and routes |
| `client/src/features/` | Account and sign-in flows, maps, policy tracking and story browsing |
| `client/src/pages/` | Landing page, About, Data Use, Sources and Feedback |
| `client/src/components/`, `i18n/`, `styles/` | Reusable controls, seven-language interface, locale catalogs and CSS |
| `shared/` | Validated record formats, statistics, public response types and source-backed content |
| `server/index.ts`, `db.ts`, `regions.ts` (in `server/`) | HTTP routes, storage and schema creation, cross-region coordination |
| `infra/` and `scripts/` | Infrastructure templates, setup helpers, data refreshes, packaging and live checks |

## Regional storage and recovery

The canonical hostname serves requests through the US App Service. Both web deployments connect to Sweden Central and North Central US using `DATABASE_URL_EU` and `DATABASE_URL_US`. Each database holds a different set of accounts. Loss of either can interrupt requests. Production requires two distinct databases and uses verified database TLS. Local development can use PGlite or one PostgreSQL connection.

For a new account, the server looks up the App Service ingress IP locally using DB-IP Country Lite. EU addresses select Sweden. Other or unknown addresses select the US. Existing accounts follow their saved home when signing in again. Review the trusted ingress header in `server/index.ts` before introducing a proxy.

An account move takes an exclusive PostgreSQL advisory lock. A journal in Sweden stores the account ID and destination. The destination commits the account, profile, story, auth and reminder records before the source is cleared. Ordinary routed requests take a shared lock and check the journal. They finish interrupted moves under an exclusive lock before resuming. If a move fails, restore connectivity and retry the same destination. Keep both regional databases together in recovery planning. The [user data guide](DATA.md) covers safe restores.

## Authentication, domains and email

- The canonical origin is `https://visatransparencypetition.org`. Custom hostnames need DNS, an Azure hostname binding and TLS. For a cutover, check the apex and www, redirects preserving deep links, `APP_URL`, and the Google OAuth callback at `/api/auth/google/callback`. The checked-in zone file describes an earlier cutover. Compare it with current DNS before importing any records.
- Email sign-in consumes a single-use token on a confirmation POST. Google sign-in verifies the identity through OAuth. Production sessions use a secure HTTP-only cookie. Store OAuth credentials, database credentials and the job secret in restricted service configuration. Browser bundles and Git are public.
- Azure Communication Services sends sign-in mail, feedback and reminders from the verified project sender. It supports a connection string or a configured endpoint with an authorized managed identity. Cloudflare Email Routing forwards incoming project correspondence. Incoming routing and the Azure sender have separate DNS requirements. Preserve Azure DKIM records and use a single SPF policy for authorized senders.
- The daily Logic App in Sweden calls `/api/jobs/reminders` using `CRON_SECRET`. Keep a single active schedule. After changing the canonical URL or secret, review and run `scripts/configure-reminders.py`. If delivery is uncertain, check the provider before retrying. The job reuses deterministic operation IDs and leaves pending claims older than 23 hours for manual reconciliation.

## Build, release and check

From the repository root, run `npm ci`, `npm run build` and `npm test`. Use `npm run dev` for the local frontend and API. Run `npm run test:integration` against a disposable local API. GitHub Actions also exercises moves between two PostgreSQL databases. See the [CI workflow](../.github/workflows/ci.yml) for the services and environment.

Package the verified build once with `python3 scripts/package.py`. Deploy that same `work/reunite-now.zip` to both App Services. The US target is `reunite-now-9a04` in `reunite-now-rg`. The Swedish target is `reunite-now-eu-9a04` in `reunite-now-eu-rg`. Startup currently runs schema migrations and a historical photo cleanup. Allow time for startup before checking the public build.

Run `python3 scripts/verify-live.py` for read-only health, configuration, coverage and Google redirect checks. Verify the public HTML serves the expected asset and open a changed route. Inspect Azure deployment status in both regions. Testing actual mail delivery requires a designated inbox. The optional `--check-reminders` flag runs the real delivery job for eligible users.

## Reducing database privileges

Today the web process performs schema changes, account writes, public reads and job work. Changing its login to read-only would break startup and interrupted-move recovery. A staged separation can preserve those operations.

1. Put schema migrations and historical backfills in a release job with its own identity. Give everyday web identities no table ownership, DDL, role administration or truncate permissions.
2. Expose narrow views or functions for public counts and published stories in each region. Grant the public reader access only to those projections. Both profile and story JSON contain private fields.
3. Bind account operations to a verified session. Limit export, change and deletion to that account. If using row-level security, enforce both read and write policies under a non-owner role and derive identity from a trusted session proof.
4. Isolate reminder delivery and transfer recovery in separately authenticated workers. Give each the fields and operations it needs. Preserve the journal and locking guarantees before switching public traffic to the reader.
5. Exercise the new roles in a disposable two-region environment. Verify sign-in, edits, export, deletion, reminders, public counts, moves and interrupted moves. Check that cross-account access, unpublished story reads and bulk deletes fail. Roll out incrementally, compare latency and error rates, then revoke and rotate the old runtime credentials.
