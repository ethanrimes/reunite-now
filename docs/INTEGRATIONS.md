# Finish the integrations

This guide is for the existing Reunite Now deployment. The application, database, email service, and reminder scheduler run on Azure. Google is only needed for Google sign-in; Render is not needed.

## What is already set up

| Integration | Current state | Remaining work |
| --- | --- | --- |
| Website and database | Azure App Service with root and www HTTPS bindings for visatransparency.org | Monitor health and certificate renewal |
| Email sign-in | Custom sender verified; test recipient confirmed inbox receipt and a working sign-in link on the new domain | Monitor delivery as usage grows |
| Google sign-in | Client credentials saved in Azure; authorization redirect verified | Complete a browser sign-in test |
| Monthly reminders | Daily Azure Logic App enabled at 16:00 UTC; endpoint uses the custom domain | Test delivery to an eligible test account, then verify an unattended run |
| Branded sender address | noreply@visatransparency.org; linked to Azure Communication Services; test delivery confirmed | Maintain DNS authentication records |

These are the deployment handoff results, not a promise that credentials or DNS will remain unchanged. Configuration flags alone do not establish successful delivery or sign-in.

## Current domain: visatransparency.org

The purchased domain uses Cloudflare DNS. The root and `www` hostnames are bound to App Service with managed SNI certificates. The canonical application URL is `https://visatransparency.org`; browser GET/HEAD requests on alternate hostnames redirect there, while the health probe remains available directly. API writes retain their origin checks.

The customer-managed email domain has verified Domain, SPF, DKIM, and DKIM2 records, engagement tracking disabled, and the `noreply` sender with display name “Reunite Now.” It is linked alongside the original Azure-managed domain. App Service uses `EMAIL_FROM=noreply@visatransparency.org`. The daily reminder workflow points to the new domain. Google credentials are configured and the new callback is registered; finish a browser sign-in and Google's public branding/verification steps separately.

The following DNS and activation instructions are retained for recovery and future changes. The records have already been imported. A single sign-in test was accepted by Azure, and the designated test recipient confirmed inbox receipt and successful login on the custom domain. Google reached its sign-in screen for the custom domain; completing a Google account login remains a separate check. An unattended reminder delivery has not been verified.

### Add the DNS records in Cloudflare

1. Open [Cloudflare Dashboard](https://dash.cloudflare.com/), select **visatransparency.org**, and go to **DNS → Records**.
2. Select **Import and Export**, then import [`infra/visatransparency.org.zone`](../infra/visatransparency.org.zone).
3. Uncheck **Proxy imported DNS records** before importing. The A and CNAME records also carry DNS-only tags in the file. Keep these records **DNS only** for Azure certificate issuance and renewal.
4. Confirm that all nine records were added. There should be one website A record, three CNAME records (`www` and two DKIM selectors), and five TXT records (two App Service ownership records, email ownership, SPF, and DMARC). This adds no MX records or incoming mailbox.
5. Tell the operator that DNS is saved so the remaining Azure steps below can run. Public DNS and Azure verification must be checked before calling the setup complete.

The generated zone file contains the app's current inbound IP, `52.162.107.35`, and the actual Azure verification tokens. It contains no credentials. Before reusing this file after infrastructure changes, compare it with the current App Service external IP, ownership token, and Email Communication Service verification records. Preserve existing records if other email providers are added later; maintain a single SPF policy rather than adding a second SPF TXT record.

### Azure activation procedure

After DNS resolves:

1. Add App Service hostname bindings for `visatransparency.org` and `www.visatransparency.org`. Issue and bind App Service Managed Certificates using SNI SSL, then verify trusted HTTPS for both names.
2. Initiate Email Communication Service verification for Domain, SPF, DKIM, and DKIM2, and inspect the resulting statuses. The zone also adds an initial DMARC `p=none` policy; this is not enforcement or delivery monitoring.
3. Link the verified custom email domain to `reunite-now-communication`, preserving its existing linked Azure-managed domain. The custom sender is `noreply@visatransparency.org`; sending does not create an inbox at that address.
4. The application now redirects alternate hostnames to the configured `APP_URL` in production. Confirm it preserves deep links and query strings; `/api/health` remains exempt for Azure probes, and writes keep their normal origin checks.
5. Once HTTPS and the sender are verified, run `python3 scripts/activate-domain.py`. It gates activation on trusted HTTPS/database health, verified sender records, the domain link, and existing credentials; changes only `APP_URL` and `EMAIL_FROM`; and updates the reminder workflow. It sends no email. App Service restarts after the settings change.
6. Wait for the restart, then run `python3 scripts/verify-live.py` and verify browser account saves and email-link destinations. If `APP_URL` or `CRON_SECRET` changes outside the activation script, rerun `python3 scripts/configure-reminders.py`. Sending a delivery test requires an explicitly identified test inbox.

`infra/custom-email.bicep` reproduces the custom email domain and sender without changing Communication Service links or application settings. It does not verify DNS, issue website certificates, or activate the sender. `infra/email.bicep` and `scripts/configure-email.py` describe the original Azure-managed sender and must not be used to overwrite the custom configuration after cutover.

## Where settings go

Open [Azure Portal](https://portal.azure.com), select subscription `9a04b64b-af19-4519-be50-56ec2acbd855` in tenant `148ba320-1a6d-4fd7-ba8b-2897083e7531`, then resource group **reunite-now-rg** → App Service **reunite-now-9a04** → **Settings → Environment variables → App settings**. Add or edit individual settings, then apply. Changes restart the application; allow it to become healthy again before testing.

| Setting | Value or purpose |
| --- | --- |
| `APP_URL` | Currently `https://visatransparency.org`; use the canonical HTTPS origin with no trailing slash |
| `GOOGLE_CLIENT_ID` | OAuth web client ID from Google |
| `GOOGLE_CLIENT_SECRET` | Matching Google client secret; server only |
| `AZURE_COMMUNICATION_CONNECTION_STRING` | Already configured; keep the existing value |
| `EMAIL_FROM` | Exact sender address registered in Azure Email |
| `CRON_SECRET` | Already configured; authorizes the reminder job |
| `DEV_AUTH` | Keep `false` in production |

Store credentials in App Service settings, never in Git, browser code, `VITE_*` variables, or screenshots. Do not run `scripts/provision.py` to add integrations: it rotates the database password and reminder secret. The steps below do not require reprovisioning.

## 1. Google sign-in

Google credentials are already configured. These steps describe recreating or updating the client. Use the canonical custom-domain callback below; retain the old Azure callback only if needed for a planned rollback.

1. Create or select a project in [Google Cloud Console](https://console.cloud.google.com/). Open **Google Auth Platform**.
2. In **Branding**, enter “Reunite Now,” a monitored support email, and developer contact details. Use the site's homepage and `/data-use` page for the corresponding URLs. When using your own domain, add it to the authorized domains and complete any ownership verification Google requests.
3. In **Audience**, choose **External**. Add your Google account under test users while testing. In **Data Access**, select only basic identity scopes: `openid`, `email`, and `profile` (the latter two may appear as `userinfo.email` and `userinfo.profile`). The application does not request Gmail or Drive access. Follow Google's publishing and verification prompts before public launch. See [Google's consent setup](https://developers.google.com/workspace/guides/configure-oauth-consent).
4. In **Clients**, create a **Web application** OAuth client named “Reunite Now production.” Add this exact **Authorized redirect URI**:

   ```text
   https://visatransparency.org/api/auth/google/callback
   ```

   For your future domain, add `https://YOUR-DOMAIN/api/auth/google/callback`. Replace `YOUR-DOMAIN` with the exact hostname you will use, including `www` if applicable. This application uses server redirects, so it does not need Authorized JavaScript origins. See [Google's OAuth client and redirect setup](https://developers.google.com/identity/openid-connect/openid-connect).
5. Copy the client ID and secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in App Service. Apply the changes. No application rebuild is required.
6. Open `/api/config` on the site: `googleAuth` should now be `true`. Then use a private browser window, open `/login`, and complete Google sign-in with an allowed account. Confirm arrival at `/account`, log out, and sign in again. There is no need to publish a synthetic petition signature to test authentication.

Keep production credentials out of local development. If local OAuth testing is needed, use a separate development client and register the callback for that environment's exact `APP_URL`.

## 2. Your website domain

Use `YOUR-DOMAIN` below as a placeholder for the domain you buy. Choose one canonical hostname, such as `www.YOUR-DOMAIN`, before changing application settings.

1. Open App Service **reunite-now-9a04 → Custom domains → Add custom domain**. For an externally purchased domain, select **All other domain services**.
2. Copy the DNS records Azure displays into your registrar's DNS panel. Typical records are:

   | Hostname being added | Routing record | Ownership record |
   | --- | --- | --- |
   | Root domain | `A`, host `@`, value: Azure's displayed inbound IP | `TXT`, host `asuid`, value: Azure's verification ID |
   | `www` | `CNAME`, host `www`, value: `reunite-now-9a04.azurewebsites.net` | `TXT`, host `asuid.www`, value: Azure's verification ID |

   Use the actual values from the portal; do not substitute the app's outbound IPs. Validate and add the hostname after DNS resolves. [Azure domain setup](https://learn.microsoft.com/en-us/azure/app-service/app-service-web-tutorial-custom-domain).
3. Select an **App Service Managed Certificate** and an **SNI SSL** binding for the hostname. The existing B1 plan supports this. Confirm that the new HTTPS URL loads without certificate errors before switching `APP_URL`. Keep HTTPS-only enabled. [Azure certificate setup](https://learn.microsoft.com/en-us/azure/app-service/configure-ssl-certificate).
4. If Google login is enabled, add the new callback URI to its OAuth client **before** changing `APP_URL`. Update Google's branding/homepage/privacy URLs too.
5. Change `APP_URL` to the canonical HTTPS origin, with no trailing slash. Apply and wait for the app restart.
6. Update the existing Azure reminder workflow to use that URL. From the repository, with Azure CLI signed into the subscription, run:

   ```sh
   cd /Users/ethan/Documents/development/reunite-now
   python3 scripts/configure-reminders.py
   ```

   This copies the current `APP_URL` and `CRON_SECRET` into the Logic App without printing the secret. It does not send a reminder.
7. Test email login, Google login, and saving an account from the new hostname. Old sessions are tied to the old hostname, so sign in again. Request a fresh email link after the switch.

**Alternate hostnames:** production browser GET/HEAD requests on the Azure hostname and `www` redirect to `APP_URL`. The health endpoint is exempt for probes. Writes do not redirect and require an Origin matching `APP_URL`, except the separately authenticated reminder job. Keep login and callback flows on the canonical hostname.

To roll back a hostname cutover, restore the old `APP_URL`, retain its Google callback, and rerun `configure-reminders.py`. Existing DNS bindings can remain while you investigate.

## 3. Email sender and sign-in delivery

Email already uses **reunite-now-communication**, linked to **reunite-now-email**. The configured sender is:

```text
noreply@visatransparency.org
```

From `/login` on `https://visatransparency.org`, request a link to an inbox you control. Check inbox and spam, verify the sender and destination hostname, and open the link within 15 minutes. Confirm that it signs you in and that reusing the same link fails. The production response must not expose a development preview link. This test creates an account, but does not sign the petition until you submit the required registration form.

### Optional: send from your own domain

1. In **reunite-now-email → Provision domains**, add your custom sending domain. A dedicated subdomain such as `mail.YOUR-DOMAIN` is an option.
2. Add the ownership TXT, SPF, and both DKIM records generated by Azure to DNS. Use the generated names and values; wait until ownership and sender authentication show verified. Preserve any existing mail provider's DNS configuration. [Azure custom sender verification](https://learn.microsoft.com/en-us/azure/communication-services/quickstarts/email/add-custom-verified-domains).
3. In **reunite-now-communication → Email → Domains**, connect the verified domain from **reunite-now-email**. Domain verification and linking are separate steps. [Azure domain connection](https://learn.microsoft.com/en-us/azure/communication-services/quickstarts/email/connect-email-communication-resource).
4. In the email domain's **MailFrom addresses**, configure your desired sender, for example `updates@mail.YOUR-DOMAIN`. Set App Service `EMAIL_FROM` to the exact registered address. Leave the existing connection string in place. Keep user engagement tracking disabled.
5. Apply settings and repeat the sign-in inbox test. This sender configuration does not create a support inbox; publish a separately monitored contact address for user questions.

`scripts/configure-email.py` restores the **Azure-managed** sender. Do not rerun it after setting a custom sender unless that rollback is intentional. Likewise, review `infra/email.bicep` before redeploying it: the template describes the initial managed-domain setup, not your future custom domain links.

## 4. Monthly reminders

The Azure Consumption Logic App **reunite-now-reminders** runs daily at **16:00 UTC**. It calls `POST /api/jobs/reminders` with a protected bearer secret. There is no Render worker to configure.

Daily scheduling does not mean daily emails. The application checks for an opted-in profile with an active visa case and a last-confirmed timestamp at least 30 days old. It sends at most once per recipient per account per UTC calendar month. The account’s sign-in address always receives opted-in reminders; the owner can add up to five additional private addresses. Addresses are normalized and deduplicated, and each receives a separate message. A delivery failure for one address does not resend successful messages to the others. The job’s `sent` and `failed` counters count recipient messages, not accounts. Updating the account or pressing “No changes” resets the confirmation timestamp without changing visa milestone dates. Turning reminders off stops eligibility.

In Azure Portal, open the Logic App and check that it is enabled. Review **Runs history**, including a run triggered by the schedule itself. Inspect the HTTP action's aggregate response: `configured` should be `true` and `failed` should be `0`. A successful workflow with `sent: 0` confirms the job ran, not that an email arrived. A run can also succeed at the HTTP level while reporting failed sends, so inspect the body.

### Test actual reminder delivery

Use a separate staging instance and database containing only test accounts, with a recipient inbox you control. Staging is not provisioned in this repository's production setup. Configure its own `APP_URL`, Azure sender settings, and job secret; keep `DEV_AUTH=false` for a production-like test.

1. Register a test profile in staging, opt into reminders, and add a synthetic active visa case.
2. In the **staging database only**, make that profile eligible without waiting 30 days. Replace the address with your test account's email:

   ```sql
   UPDATE profiles
   SET updated_at = now() - interval '31 days'
   WHERE user_id = (
     SELECT id FROM users WHERE email = 'YOUR-TEST-EMAIL'
   ) AND data->>'reminders' = 'true';
   ```

   Confirm exactly one row changed. An old filing date alone does not make a profile eligible. Do not backdate real participants' confirmation timestamps.
3. Invoke the staging reminder endpoint using that environment's job secret in a private HTTP client. With only the sign-in address, expect `sent: 1, failed: 0`. If additional addresses are configured, expect one sent message per distinct selected address. Confirm messages arrive separately, contain the staging account link, and contain no applicant details or other recipient addresses.
4. Invoke it again in the same month: expect `sent: 0`. Sign in and press “No changes”; confirm the last-checked date updates while event dates stay intact. Turn reminders off and confirm they remain disabled after reloading.
5. For a separate eligible staging account, let a scheduled run deliver the message without manual invocation. Delete test accounts afterward through Account.

For production, `python3 scripts/verify-live.py --check-reminders` invokes the **real production job** and may email every eligible opted-in user. It is not a dry run or a staging command. Without that flag, the script is read-only. Rerun `configure-reminders.py` whenever production `APP_URL` or `CRON_SECRET` changes.

Pending account or recipient ledger entries older than 23 hours require manual reconciliation with Azure delivery status before retrying. They are skipped by the job and are not reported in a separate skipped counter. Do not erase delivery records simply to force another send.

## Final checks and troubleshooting

Run the read-only check for the canonical hostname:

```sh
python3 scripts/verify-live.py
```

That script targets `https://visatransparency.org` and also verifies the Google authorization redirect and callback hostname. After a future domain cutover, update the script base URL and test browser login and saving on the new canonical hostname. Expected flags are `devAuth: false`, `emailAuth: true`, `reminders: true`, and `googleAuth: true` once Google is configured. These flags indicate settings are present, not provider validation.

| Symptom | Check |
| --- | --- |
| Google `redirect_uri_mismatch` | Exact scheme, hostname, callback path, and absence of a trailing slash; compare with `APP_URL` |
| Google denies an account | Audience, testing/publishing state, any requested verification, and account organization restrictions |
| Google returns to login with an error | Matching client ID/secret, cookies, and starting/finishing on the same hostname |
| Saving returns “Request origin not allowed” | Browser origin must match `APP_URL` exactly |
| Email never arrives | Spam folder, Azure send/delivery diagnostics, registered sender, verified and connected domain, and current service quotas |
| Reminder run returns 401 | Rerun `configure-reminders.py` after a secret change |
| Reminders point to the old domain | Update `APP_URL` and rerun `configure-reminders.py` |
| Reminder run sends zero | Opt-in, active case, profile confirmation age, and existing monthly delivery ledger |

Before public outreach, confirm both login methods work, a real message arrives, the canonical hostname supports account saves, and the reminder schedule is enabled. Record inbox delivery and unattended reminder results separately from configuration checks. For deployment and database recovery, see [Operations](OPERATIONS.md).

## Address suggestions and street maps (Azure Maps)

Configured November 12, 2026 in the existing Azure resource group:

- Account: `reunite-now-maps`, Gen2 / G2, global.
- Local/shared-key authentication is disabled. No Maps key is embedded in the browser.
- App Service's existing system-assigned identity has **Azure Maps Search and Render Data Reader**, scoped only to that Maps account.
- App setting `AZURE_MAPS_CLIENT_ID` holds the account's **unique client ID**, not an application secret. This setting is already installed in production.
- For local development, sign in with `az login`, use an identity with the same data-reader role, then run `AZURE_MAPS_CLIENT_ID=<account unique ID> npm run dev:demo`. The configured developer identity already has the role on this account. Do not commit access tokens or subscription keys.

The signed-in browser calls the same-origin Express API. Azure's `DefaultAzureCredential` uses managed identity in App Service and the developer's Azure CLI locally. `/api/maps/suggest` is authenticated, rate-limited and debounced; `/api/maps/district` uses Census TIGER point intersection. Tiles are proxied, and map attribution is requested for the visible viewport. Addresses and coordinates are transient and not written to our database. Azure Maps (including its mapping providers) and Census receive the requests; their own policies apply. Do not add request-body logging to these routes.

If recreating this integration: create a Gen2 Maps account, enable App Service managed identity, grant the scoped data-reader role, and put the Maps account's `properties.uniqueId` in `AZURE_MAPS_CLIENT_ID`. Allow time for role propagation. Confirm an address suggestion, district, road tiles, and district overlay after deployment. A full-address Census fallback and manual state/district selection remain available when suggestions fail. Azure Maps is metered; review its usage in Azure Cost Management alongside the existing app budget.

No Google Maps, Google Places, or separate geocoding subscription is needed. Existing Google sign-in, Azure email delivery, and reminder scheduling are unchanged. No additional credentials are pending for this feature.
