# Move to visatransparencypetition.org

Prepared November 13, 2026. The existing App Service and database are reused; no user records are copied or removed.

## Current state

- Cloudflare website records resolve to `reunite-now-9a04.azurewebsites.net` / `52.162.107.35`.
- Azure hostname bindings exist for the root and `www`. Managed certificates `reunite-petition-apex` and `reunite-petition-www` are issued and bound with SNI.
- The new Azure Email domain and `noreply` sender are provisioned. DNS verification and linking remain pending.
- The production `APP_URL` and sender remain on `visatransparency.org` until the prerequisites below are confirmed. No sign-in or reminder test messages were sent for this migration.

## Google callback

Open the existing [Reunite Now production OAuth client](https://console.cloud.google.com/auth/clients/597122622466-ecqt2g52s3c9165thshrfeligg5kqbcv.apps.googleusercontent.com?project=reunite-now). Add this Authorized redirect URI and save:

```
https://visatransparencypetition.org/api/auth/google/callback
```

Retain the previous domain callback for rollback. In Branding, add `visatransparencypetition.org` to Authorized domains and update the homepage to `https://visatransparencypetition.org` and privacy policy to `https://visatransparencypetition.org/data-use`. The app uses server-side OAuth; it does not require a JavaScript origin entry.

## Email DNS

Import [the prepared zone](../infra/visatransparencypetition.org.zone) into the new Cloudflare zone. It contains the four existing website records plus Domain verification, SPF, two DKIM CNAMEs, and DMARC. Keep A/CNAME records DNS-only. Do not change or delete the previous domain's records.

Verify Domain, SPF, DKIM, and DKIM2 in the Azure Email domain, then link the verified domain to `reunite-now-communication`, preserving its existing linked domains. The target sender is `noreply@visatransparencypetition.org`.

## Activate

Confirm the Google callback is saved before changing `APP_URL`. Run a read-only preflight:

```sh
python3 scripts/activate-domain.py --domain visatransparencypetition.org --check-only
```

After all checks pass, activate the website/sender and refresh the existing Azure reminder schedule:

```sh
python3 scripts/activate-domain.py --domain visatransparencypetition.org
python3 scripts/verify-live.py --base-url https://visatransparencypetition.org
```

If only the new email DNS is pending, `--sender-domain visatransparency.org` keeps the already verified sender while changing website/login/reminder link destinations. Google callback registration is still required first. Neither activation nor the default smoke check sends email.

Verify old root, old www, new www, and Azure-host deep links redirect to the new root, preserving paths and query strings. Check Google sign-in and email sign-in with an authorized test inbox. Existing account data stays intact; users sign in again because cookies are scoped to a domain. Update the current-domain notes in README, INTEGRATIONS, and OPERATIONS after successful cutover.

## Rollback

Retain the old TLS bindings and DNS, sender verification, and OAuth callback. To restore the old canonical URL and sender:

```sh
python3 scripts/activate-domain.py --domain visatransparency.org
python3 scripts/verify-live.py --base-url https://visatransparency.org
```

This also restores the reminder workflow destination. `--check-reminders` runs the real production job and must not be used as a read-only migration check.
