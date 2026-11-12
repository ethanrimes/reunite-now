# Reunite Now

A visa-processing advocacy site: a petition, sourced policy tracker, personal stories, geographic signature coverage, and community-reported visa timelines.

## Run locally

Requires Node 22+ (Azure uses Node 24) and npm. No separate database installation is needed for development.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The API runs on port 3001. Development email sign-in returns a one-time preview link; it cannot be enabled in production. Local data stays in `.local/postgres` and is ignored by Git. Never use real personal information in test fixtures.

Optional environment settings are listed in `.env.example`. The runtime reads process environment variables; to load a file, use Node's `--env-file` support (for example `NODE_OPTIONS=--env-file=.env npm run dev`). Do not commit `.env` or credentials.

## Validate

```sh
npm run build
npm test
# While npm run dev is running:
npm run test:integration
```

Tests cover timeline calculations, date validation, SQL transactions, deletion cascades, authentication, ownership, consent, public-data filtering, exports, and no-change confirmation. The integration test creates and deletes its own synthetic local account.

## Hosting

The backend stays on Azure: App Service (Node/Express and static React files), PostgreSQL Flexible Server, Azure Communication Services Email, and a scheduled App Service WebJob. No Render service or third-party email provider is required.

Infrastructure definitions are under `infra/`; provisioning, email configuration, and packaging scripts are under `scripts/`. See [operations](docs/OPERATIONS.md) before redeploying infrastructure or restoring a database.

```sh
npm run build
python3 scripts/package.py
az webapp deploy --resource-group reunite-now-rg --name reunite-now-9a04 --src-path work/reunite-now.zip --type zip
```

The app creates its SQL tables on first boot. Build artifacts, deployment packages, local databases, and secrets are excluded from Git.

## Code map

- `client/src/`: responsive light UI, account and story editing, Leaflet maps, tables.
- `shared/schema.ts`: validated profiles, cases, milestones, and stories.
- `shared/metrics.ts`: case state, date intervals, filters, and medians.
- `shared/policies.ts`: manually reviewed policy and litigation entries with source links.
- `server/`: authentication, PostgreSQL persistence, public projections, exports/deletion, Azure email, reminders.
- `scripts/refresh-data.ts`: Census boundaries, current congressional members, and Natural Earth countries; source timestamps are stored alongside the data.

## Current limits

Google sign-in is implemented but needs an OAuth client ID and secret. A custom domain can be attached later. Email is configured through an Azure-managed sender domain; end-to-end inbox delivery and an unattended monthly reminder still need a live test.

Policy updates are editorial, not an automatic docket feed. Member cards show the tracked bill's sponsorship and voting status; they are not a complete historical voting database. Syed v. Trump is marked as needing a current status check. The world map is generalized and omits some small countries; country selections and table statistics still accept them.

Public statistics are self-reported, with metric-specific sample sizes and no invented signatories. Public profiles intentionally expose the fields described in the consent form; emails and authentication data remain private. The initial release loads public profiles to calculate aggregates in the browser. Larger deployments should move aggregation to indexed server queries and photo storage to Azure Blob Storage.

Stories publish when their author opts in. There is no staffed moderation queue or automated content screening. Before outreach, establish a monitored contact and moderation process. See [data and privacy](docs/DATA.md).
