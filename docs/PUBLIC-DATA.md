# Public sources and editorial updates

The public site combines two kinds of reference material. The refresh scripts download a chosen set of structured records. Editors discover new bills, review court orders and agency notices, and decide which developments belong in the tracker. Running either script does not discover new lawsuits or verify that a call for cases is still open. Participant records are documented in [User data](DATA.md).

## Source inventory

| Material | Source and selection | Files to update |
| --- | --- | --- |
| Bills and actions | GovInfo BILLSTATUS XML for the Congress, chamber and bill numbers listed in the refresh script. The text and all-actions pages linked from each initiative provide context. | [Bill and vote fetcher](../scripts/refresh-legislation.py), [downloaded records](../shared/legislation.json), [editorial groupings](../shared/legislation.ts) |
| Individual votes | House Clerk and Senate roll-call XML for selected passage and concurrence votes. The fetcher maps Senate LIS IDs to Bioguide IDs using the current and historical Congress Legislators rosters. | Same fetcher and downloaded records |
| Court cases, visa policy and news | Docket entries and court orders, State Department notices, and case counsel's published updates. Each entry identifies its source. | [Policy detail records](../shared/policies.ts), [news, timeline and participation links](../shared/campaign.ts) |
| Congressional geography and representation | Census TIGERweb state and congressional district layers. Current officeholders are selected from Congress Legislators terms in force on the retrieval date. | [Map and roster fetcher](../scripts/refresh-data.ts), [bundled map files, roster and source manifest](../public/data/) |
| Country shapes and choices | Natural Earth 1:50m polygons plus explicit small-country and territory labels in the fetcher. Some selectable countries have no visible polygon at this scale. | Same fetcher, `public/data/world.json`, [country choices](../shared/countries.json) |
| Consular posts and visa process | State Department Global Visa Wait Times post directory and published family, K-1, diversity and visitor process guides. A listed post may have limited service. | [Post directory with source and retrieval date](../shared/posts.json), [case templates and policy context](../shared/visa-workflow.ts), [Sources page](../client/src/pages/sources.tsx) |
| IP-country lookup | Monthly DB-IP Country Lite compressed MMDB, used locally for initial storage assignment. | [Database provenance, license and replacement instructions](../server/data/README.md) |

## Find and verify legislation

1. Search Congress.gov within the relevant Congress. Search bill titles and text for terms such as *consular staffing*, *post-interview processing*, *visa wait times*, *family reunification* and *visa recapture*. Follow related bills, committee referrals and earlier versions. A press release can identify a proposal. Confirm its measure number and text in the official record. [Congress.gov search](https://www.congress.gov/advanced-search) · [GovInfo bill status](https://www.govinfo.gov/bulkdata/BILLSTATUS)
2. Read the provisions that affect visa processing. Record the Congress, chamber, number and latest action. Preserve distinctions among introduction, passage in one chamber, enactment and implementation. Identify which provisions of a larger package affect this project. For an existing example, trace H.R. 10711 from its text to the repository key `119-hr-10711`. [Reducing Visa Delays Act as introduced](https://www.govinfo.gov/content/pkg/BILLS-119hr10711ih/html/BILLS-119hr10711ih.htm)
3. Add newly selected measures to `BILLS` in the fetcher. For a recorded vote, confirm the measure, chamber, Congress/session, date, roll number and question. Add the matching tuple to `HOUSE` or `SENATE`. A package vote applies to the entire package. Voice votes have no member-by-member tally. Keep sponsorship, explicit “Not Voting” and absence from the roster distinct. [House Clerk votes](https://clerk.house.gov/Votes) · [Senate votes](https://www.senate.gov/legislative/votes_new.htm)
4. Run `npm ci` and `npm run data:legislation` from the repository root with Python 3 available. Inspect the JSON diff for actions, active cosponsors, vote questions and member ID joins. Investigate an unmapped senator. Group companions in `shared/legislation.ts`, add or update the policy summary and timeline as appropriate, and keep stable IDs so older links still work.

## Verify news, litigation and requests for cases

Start from the linked docket or case page. Search by court and docket number as well as party names. For example, the tracker indexes Castillo v. Rubio under **1:26-cv-11422** in the Northern District of Illinois and De Moura Gomes v. Rubio under **1:26-cv-01883** in the District of Columbia. For CLINIC v. Rubio, check counsel's case page, the underlying orders, any later appeal or stay, and the agency's implementation notice. CourtListener's RECAP collection can help locate publicly available filings. Check the issuing court or PACER when public copies are incomplete. [CourtListener](https://www.courtlistener.com/) · [PACER Case Locator](https://pcl.uscourts.gov/) · [NILC case page](https://www.nilc.org/litigation/clinic-v-rubio/) · [State Department visa news](https://travel.state.gov/content/travel/en/News/visas-news.html)

Read the dated document. Record who acted, what changed, who was covered, the effective date and any later modification. Distinguish a party's request from an order, and an individual remedy from class-wide relief. Attribute counsel's interpretation. If the latest status cannot be verified, label that uncertainty. A social post can suggest a lead. Link readers to the notice, order or filing that supports the published claim.

Use `shared/campaign.ts` for dated developments and participation links. Use `shared/policies.ts` for a case's background, status, checked date, sources and case-specific participation guidance. Use the event date for the timeline and the actual review date for the source check. When guidance changes, retain enough history for a reader to understand which period it covered.

For a request for cases, confirm that the organization itself invites submissions, who qualifies, where material goes, and any deadline. Follow the link from the organization's own site before publishing a third-party intake form. Describe the requested action and link directly to the organizer. Retire closed invitations. People decide whether to contact the organizer themselves. Petition records and feedback are never forwarded as case leads.

## Refresh maps, members and post choices

Run `npm run data:refresh` from the repository root with dependencies installed. It downloads shapes and current terms and writes several files sequentially. If a source fails, inspect the working tree for partial updates before retrying. Compare feature counts, GEOIDs, member terms, country labels and `public/data/sources.json` against the previous snapshot. Preserve district `00` for at-large seats and `98` for delegates. Check vacancies and district assignments against the member's official listing.

At a congressional transition, select the TIGERweb layer for the intended Congress and update the Congress number, notes, labels and tests together. Confirm that members and boundaries represent the same period. Inset projections move Alaska, Hawaii and the territories for display. Signature joins still use the original state and district identifiers.

Post names are maintained separately. Compare the source recorded in `shared/posts.json` with the saved choices and update its retrieval date. Preserve existing account values when a post is renamed. Review changes to filing and interview stages against the agency process guide for the visa category. Update the DB-IP attribution and run the regional integration tests when changing the bundled country lookup.

## Publish an update

Review the source and date for each changed claim. Update editorial review dates only for material actually checked, including the explicit review date in the legislation fetcher when appropriate. Translate new interface labels and summaries in all supported catalogs. Official titles and action text retain their original wording. Run `npm run build` and `npm test`. Open the policy detail, timeline, Sources page and any affected map or member card. Verify source and intake links, inspect the generated diff, and publish the reviewed snapshots together.
