# Finish the integrations

This guide is for the existing Reunite Now deployment. The application, database, email service, and reminder scheduler run on Azure. Google is only needed for Google sign-in; Render is not needed.

## What is already set up

| Integration | Current state | Remaining work |
| --- | --- | --- |
| Website and database | Deployed on Azure | Attach your domain when purchased |
| Email sign-in | Azure sender and credentials configured | Receive and use a real sign-in email |
| Google sign-in | Application code implemented; credentials absent | Create an OAuth client and test login |
| Monthly reminders | Daily Azure Logic App installed; manual empty run succeeded | Test delivery to an eligible test account, then verify an unattended run |
| Branded sender address | Azure-managed address available | Optional: verify your own sending domain |

These are the deployment handoff results, not a promise that credentials or DNS will remain unchanged. Configuration flags alone do not establish successful delivery or sign-in.

## Where settings go

Open [Azure Portal](https://portal.azure.com), select subscription `9a04b64b-af19-4519-be50-56ec2acbd855` in tenant `148ba320-1a6d-4fd7-ba8b-2897083e7531`, then resource group **reunite-now-rg** → App Service **reunite-now-9a04** → **Settings → Environment variables → App settings**. Add or edit individual settings, then apply. Changes restart the application; allow it to become healthy again before testing.

| Setting | Value or purpose |
| --- | --- |
| `APP_URL` | Currently `https://reunite-now-9a04.azurewebsites.net`; use the final HTTPS origin with no trailing slash |
| `GOOGLE_CLIENT_ID` | OAuth web client ID from Google |
| `GOOGLE_CLIENT_SECRET` | Matching Google client secret; server only |
| `AZURE_COMMUNICATION_CONNECTION_STRING` | Already configured; keep the existing value |
| `EMAIL_FROM` | Exact sender address registered in Azure Email |
| `CRON_SECRET` | Already configured; authorizes the reminder job |
| `DEV_AUTH` | Keep `false` in production |

Store credentials in App Service settings, never in Git, browser code, `VITE_*` variables, or screenshots. Do not run `scripts/provision.py` to add integrations: it rotates the database password and reminder secret. The steps below do not require reprovisioning.

## 1. Google sign-in

You can enable this on the current Azure hostname now and add your domain later.

1. Create or select a project in [Google Cloud Console](https://console.cloud.google.com/). Open **Google Auth Platform**.
2. In **Branding**, enter “Reunite Now,” a monitored support email, and developer contact details. Use the site's homepage and `/data-use` page for the corresponding URLs. When using your own domain, add it to the authorized domains and complete any ownership verification Google requests.
3. In **Audience**, choose **External**. Add your Google account under test users while testing. In **Data Access**, select only basic identity scopes: `openid`, `email`, and `profile` (the latter two may appear as `userinfo.email` and `userinfo.profile`). The application does not request Gmail or Drive access. Follow Google's publishing and verification prompts before public launch. See [Google's consent setup](https://developers.google.com/workspace/guides/configure-oauth-consent).
4. In **Clients**, create a **Web application** OAuth client named “Reunite Now production.” Add this exact **Authorized redirect URI**:

   ```text
   https://reunite-now-9a04.azurewebsites.net/api/auth/google/callback
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

**Alternate hostnames:** the current app does not automatically redirect the Azure hostname or a second custom hostname to the canonical one. Account mutations require an Origin matching `APP_URL`; using another hostname can produce a 403. Share only the canonical URL. If both root and `www` must be public entry points, add and test a canonical-host redirect before promoting both. Keep login and callback flows on the same hostname.

To roll back a hostname cutover, restore the old `APP_URL`, retain its Google callback, and rerun `configure-reminders.py`. Existing DNS bindings can remain while you investigate.

## 3. Email sender and sign-in delivery

Email already uses **reunite-now-communication**, linked to **reunite-now-email**. The configured sender is:

```text
DoNotReply@da648e27-4c8c-446c-8a98-a6f5c36dd905.azurecomm.net
```

You can test delivery without buying a domain. From `/login`, request a link to an inbox you control. Check inbox and spam, verify the sender and destination hostname, and open the link within 15 minutes. Confirm that it signs you in and that reusing the same link fails. The production response must not expose a development preview link. This test creates an account, but does not sign the petition until you submit the required registration form.

### Optional: send from your own domain

1. In **reunite-now-email → Provision domains**, add your custom sending domain. A dedicated subdomain such as `mail.YOUR-DOMAIN` is an option.
2. Add the ownership TXT, SPF, and both DKIM records generated by Azure to DNS. Use the generated names and values; wait until ownership and sender authentication show verified. Preserve any existing mail provider's DNS configuration. [Azure custom sender verification](https://learn.microsoft.com/en-us/azure/communication-services/quickstarts/email/add-custom-verified-domains).
3. In **reunite-now-communication → Email → Domains**, connect the verified domain from **reunite-now-email**. Domain verification and linking are separate steps. [Azure domain connection](https://learn.microsoft.com/en-us/azure/communication-services/quickstarts/email/connect-email-communication-resource).
4. In the email domain's **MailFrom addresses**, configure your desired sender, for example `updates@mail.YOUR-DOMAIN`. Set App Service `EMAIL_FROM` to the exact registered address. Leave the existing connection string in place. Keep user engagement tracking disabled.
5. Apply settings and repeat the sign-in inbox test. This sender configuration does not create a support inbox; publish a separately monitored contact address for user questions.

`scripts/configure-email.py` restores the **Azure-managed** sender. Do not rerun it after setting a custom sender unless that rollback is intentional. Likewise, review `infra/email.bicep` before redeploying it: the template describes the initial managed-domain setup, not your future custom domain links.

## 4. Monthly reminders

The Azure Consumption Logic App **reunite-now-reminders** runs daily at **16:00 UTC**. It calls `POST /api/jobs/reminders` with a protected bearer secret. There is no Render worker to configure.

Daily scheduling does not mean daily emails. The application checks for an opted-in profile with an active visa case and a last-confirmed timestamp at least 30 days old. It sends at most once per UTC calendar month. Updating the account or pressing “No changes” resets the confirmation timestamp without changing visa milestone dates. Turning reminders off stops eligibility.

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
3. Invoke the staging reminder endpoint using that environment's job secret in a private HTTP client. Expect `sent: 1, failed: 0`, then confirm the message arrives, contains the staging account link, and contains no applicant details.
4. Invoke it again in the same month: expect `sent: 0`. Sign in and press “No changes”; confirm the last-checked date updates while event dates stay intact. Turn reminders off and confirm they remain disabled after reloading.
5. For a separate eligible staging account, let a scheduled run deliver the message without manual invocation. Delete test accounts afterward through Account.

For production, `python3 scripts/verify-live.py --check-reminders` invokes the **real production job** and may email every eligible opted-in user. It is not a dry run or a staging command. Without that flag, the script is read-only. Rerun `configure-reminders.py` whenever production `APP_URL` or `CRON_SECRET` changes.

Pending ledger entries older than 23 hours require manual reconciliation with Azure delivery status before retrying. They are skipped by the job and are not reported in a separate skipped counter. Do not erase delivery records simply to force another send.

## Final checks and troubleshooting

Run the existing read-only check for the Azure hostname:

```sh
python3 scripts/verify-live.py
```

That script currently targets the Azure hostname. After a domain cutover, also open `https://YOUR-DOMAIN/api/health` and `/api/config`, and test browser login and saving on the canonical hostname. Expected flags are `devAuth: false`, `emailAuth: true`, `reminders: true`, and `googleAuth: true` once Google is configured. These flags indicate settings are present, not provider validation.

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
