# User data

A person can sign as a supporter, report a visa case, publish a story or send private feedback. Each has a different audience and deletion path. The participant-facing explanation lives at [Data Use & Privacy](https://visatransparencypetition.org/data-use). The implementation is in [the shared schemas](../shared/schema.ts) and [the API](../server/index.ts).

| Record | Stored information | Who receives it |
| --- | --- | --- |
| Account and authentication | Account ID, sign-in email, creation time, hashed link and session tokens with expiry | The authenticated owner and authorized operators. Azure delivers sign-in links. Google verifies the email for Google sign-in. |
| Signed profile | Self-reported name, country of residence, US state and district where applicable, citizenship or residency category, visa involvement, consent version and timestamps | Consented records supply geographic counts and filters. Optional party affiliation contributes only with separate consent from a US citizen. City and street address are not profile fields. |
| Visa cases | Applicant label, role, relationship, nationality, post, category, dated milestones and optional sharing choices inside the profile | Only opted-in cases appear in public timelines. Each row gives the visa type, post, selected milestone date and wait. A separate opt-in shares the types and dates of all completed milestones. Neither view includes names or IDs. |
| Story and photos | Title, narrative, impacts, support text, up to four photos and publication and rights choices | Publishing with a consented signature displays the author's name, country, story and photos. Drafts stay with the account. Story publication is independent of any individual case timeline. |
| Reminder preferences and deliveries | Opt-in, up to five additional addresses, monthly claims and delivery status | Each opted-in recipient gets an individual message. Extra addresses are notification destinations. Operators with database access can read stored addresses. |
| Feedback | Message and verified account email used as the reply address | Azure emails the maintainer. Cloudflare forwards incoming correspondence to Gmail. Feedback is held in email outside the account databases. |

## Collection and publication

The form requires adult and publication consent to sign. Supporters can sign without cases. Signers who report involvement add a dated case and identify their role. The form links to the House district finder. A US signer chooses their district in the application. Personal details and stories are self-reported.

The public API groups signature counts by residence. A separate list shows only the names and original signing times of signers who enable it. Other signatures, including those recorded before this choice was available, appear as anonymous rows derived from the aggregate count. Their signing times remain private. New signers must expressly agree to publish their name and signing time when signing. Signers can later change their visibility in Configuration.

The visa timelines chart and table use the same voluntarily shared active immigrant and K visa cases. The owner can withdraw sharing in the case editor. Missing milestones contribute no duration, and future interviews are appointments rather than completed interviews. The [metric definitions](../shared/visa-timelines.ts) govern the three waits. A small sample may describe one person and is not a forecast.

The story gallery loads published text and small covers for local search, and loads full photos when someone opens a story. All these requests check publication and consent. The browser may reuse the results for one minute between visits, and already-open pages can retain the content they received. The server validates and re-encodes supported images, drops embedded metadata and produces a smaller cover. An unreadable historical photo can remain in the owner's export while being withheld from public display. People can copy material while it is public.

## Storage and retention

The initial local IP-country lookup selects Sweden for EU addresses and the US otherwise. The application does not save the lookup IP in the account tables. An owner can move their account under **Account → Configuration → Account storage**. A move changes the account's live database home. The US web service can process requests for both regions, public statistics read both, the Swedish scheduler runs reminders, and the US email service handles outgoing delivery. An old region's backups can still contain earlier records.

Accounts, signatures and story drafts have no automatic expiry. Email links expire after 15 minutes and sessions after 30 days. Expired auth rows are purged on startup and periodically. Reminder delivery records are tied to the account. Reminders require opt-in, an active case and at least 30 days since confirmation. Removing an address or turning off reminders stops future eligible deliveries. Mail already in flight can still arrive.

## Export, correct or delete

- Owners can edit their profile and cases, unpublish or delete a story, and change reminders in Account. **Configuration → Export my data** downloads the account email, profile, story, session dates and account reminder delivery history. Token values stay private.
- **Configuration → Delete account** requires typing `DELETE`. The server removes the account and dependent rows, including its profile, cases, story, photos, sessions and reminder history, and deletes pending sign-in links for its email. New public queries then exclude the account. Account deletion does not remove correspondence already delivered to mailboxes.
- People who cannot sign in, appear in someone else's submission or receive unwanted reminders can contact [the project maintainer](mailto:ethan@visatransparencypetition.org). Signed-in users can also use the feedback form. Request the public URL or story title and the change needed. Avoid collecting case numbers or identity documents. Check the inbox and spam folder. Track the request, deadline and outcome privately. Verify removal on both the page and API, and review relevant email copies separately.

Azure's configured database recovery window is seven days. Underlying backup files may persist longer. Restore to an isolated environment. Reconcile both regions for moves and deletions, plus later profile edits, withdrawn consent, unpublished stories and changed recipients, before serving restored data. Account IDs alone cannot establish those changes. The app has no independent deletion ledger. Keep an unreconciled restore offline.

For a suspected disclosure, contain access, record when it was discovered and what data was involved, and assess applicable notification duties. Keep investigation details and privacy correspondence in restricted storage. Review the public data-use notice whenever fields, recipients, retention or regional processing change.

### Troubleshooting email sign-in

The issuing web service writes private JSON Lines files to `/home/data/email-signin/` in Azure App Service (`.local/email-signin/` locally). Authorized operators can use the app’s authenticated SCM console to find an issuance by normalized email, then follow its `linkId` across the files. A browser-reported `suppliedRef` can also match an issuance when the URL fragment is lost. A provided reference alone never authenticates a user. Legacy links or URLs stripped of both values can have no identifiable recipient.

Entries record UTC time, stage, link or code method, outcome, HTTP status, and an error reason and message on failure. An accepted Azure operation may also include its delivery ID. Acceptance means Azure accepted the message for delivery. A session-created event means the server issued a session. A browser report describes what that browser observed. To distinguish a replay from a previously purged link, look for an earlier success with the same reference. Sign-in codes, bearer URLs, session cookies, IP addresses and raw provider responses are excluded. The app prunes files older than the last seven UTC calendar dates at startup and hourly while running. Diagnostics run independently of registration.
