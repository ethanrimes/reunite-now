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

### Preview with sample data

Open `/demo` on the live site or `http://127.0.0.1:5173/demo` locally for a read-only sample view with 840 fictional signatures, varied visa timelines, and eight stories. Nested routes such as `/demo/coverage` and `/demo/stories` can be shared directly. A banner labels every preview page and links back to the live view. No extra configuration is needed. Fixtures are generated in memory and never stored or enrolled in emails. Dates refresh daily. Photos reuse the site's illustrative image and do not depict the fictional storytellers.

For a local development session that also exercises account editing, `npm run dev:demo` still enables local fixtures alongside local accounts. This environment flag is ignored in production.

To remove the samples, stop the server and restart with `npm run dev`. Your own local account data is preserved. Demo mode is disabled whenever `NODE_ENV=production`, even if `DEMO_DATA=true` is set. The public Azure site is unaffected by a local preview.

## Validate

```sh
npm run build
npm test
# While npm run dev is running:
npm run test:integration
```

Tests cover timeline calculations, date validation, SQL transactions, deletion cascades, authentication, ownership, consent, public-data filtering, exports, no-change confirmation, and per-recipient reminder deduplication/retries/concurrency. Reminder tests use a fake sender and never send real email. The integration test creates and deletes its own synthetic local account.

## Project guides

- [Architecture](docs/ARCHITECTURE.md) describes the frontend structure, regional request routing, authentication, deployment, email and recovery.
- [User data](docs/DATA.md) follows a submission from collection through publication, regional transfer, export and deletion.
- [Public data and sources](docs/PUBLIC-DATA.md) explains how to discover and verify legislation, votes, news and litigation, review case intake requests, and refresh maps and directories.

## Reminder recipients

In Account, enable monthly reminders and add up to five extra email addresses alongside your sign-in address. Only add addresses you own or have permission to notify. Save the account to apply additions or removals. Addresses stay private, appear in your data export, and receive separate messages without applicant details or the other addresses. Turning reminders off stops all recipients. Existing accounts continue using their sign-in email. No new Azure service or credential is required; the application creates the additional delivery ledger on startup.

## Languages

The header selector supports English, Spanish, Brazilian Portuguese, Tagalog, Arabic, Bengali, and Traditional Chinese. English is the default; the choice is stored in this browser and survives navigation and reloads. Switching languages keeps unsaved form input and filters intact. The page language, title, dates, number formatting, controls, policy summaries, privacy text, and consent labels follow the selection. Arabic also switches the layout to right-to-left, including the timeline navigation; maps and email/date inputs retain their physical orientation. Bengali and Traditional Chinese use script-aware system fonts. No new integration or API key is needed for these languages.

Translations are keyed by the English interface text. Spanish, Portuguese, and Tagalog are maintained in `client/src/i18n/locales/messages.json`; Arabic, Bengali, and Traditional Chinese each have a corresponding `ar.json`, `bn.json`, or `zh-Hant.json` catalog in the same directory. Add every new interface string to all catalogs. Use `t()` for display text and placeholders for variable values; keep API values, IDs, option values, and React keys unchanged. `tests/i18n.test.ts` checks catalog coverage, placeholders, and stable values. No translation service or additional integration is required. Personal stories, names, source documents, and outgoing emails remain in their original language. The selector does not translate content submitted by participants.
