# Data, sources, and interpretation

Profiles and timelines become public only after mandatory petition and public-use consent. Email, authentication records, and reminder preference are never returned by the public endpoints. A public nickname is supported. An address lookup forwards the request to Census and returns only the district/state selection; it does not persist the address or coordinates. Photos are re-encoded in the browser before upload to remove embedded metadata.

Account deletion removes the user, signature, case timelines, story/photos, sessions, pending login tokens for the email, and reminder ledger. Export provides the user's profile and story. Operational backup limitations are described in OPERATIONS.md and on the data-use page.

## Metrics

All durations use calendar days. Missing dates do not contribute to a metric's median or sample size. Zero-day durations are valid. Future interviews are appointments, not completed interviews. Administrative processing under section 221(g) and policy-related refusals stay active until a final refusal, approval, visa issuance, or withdrawal. Reopening returns a case to active status. Repeated interviews are supported. Initial approval is used as the decision date when issuance follows it.

The map groups applicants by their submitted country, not the location of the embassy. A processing-post filter is separate. Post names are user supplied and can need editorial normalization. Recency is the account holder's explicit last confirmation, not a government verification. A sample of one is labeled n=1; public consent covers the underlying timeline as well as its aggregate.

## Reference data

- US states and 119th congressional districts: US Census TIGERweb. Sources and retrieval timestamps: `public/data/sources.json`. District `00` is at large; `98` is a non-voting delegate/resident commissioner district. Unassigned `ZZ` geometry is excluded.
- Member roster: `unitedstates/congress-legislators`, terms valid on the refresh date. Member cards link to official biographical and office pages. Congress changes require a coordinated boundaries/roster refresh; election winners are not seated incumbents until their term starts.
- Countries: Natural Earth 1:110m administrative polygons, public domain. This simplified map omits some small countries, which remain selectable in account forms and included in tables. Boundaries are for visualization, not a statement about territorial recognition.
- Policy records: `shared/policies.ts`, each with primary sources and a checked date. Never infer a vote from party affiliation or sponsorship. H.R. 10711 has no recorded floor vote in the reviewed sources. The separate Syed litigation entry clearly labels unverified current status.

Run `npm run data:refresh` and review the changed counts/dates before committing a new data release. Refresh legislation/court summaries manually against the linked original sources. The public build does not silently scrape court dockets.

## Publication operations

The author chooses whether a story is published. The first version has no moderation staff or review queue. Establish a monitored reporting contact, removal procedure, and editorial ownership before broad public recruitment. This application does not send stories to politicians or legal teams automatically. No petition delivery to Congress or agencies has occurred.
