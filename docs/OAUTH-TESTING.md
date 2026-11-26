# Testing petition sign-in

The local test instance uses `http://localhost:31551` and an in-memory database. Restarting clears its petition accounts. Enter test credentials in the ignored `.env.oauth-test` file using the variable names in `.env.example`. Set `PORT=31551`, `APP_URL=http://localhost:31551` and `TEST_DB=1`. Build with `npm run build` and start with `node --env-file=.env.oauth-test dist/server.js`. Open `/login?intent=sign`.

Register a **Web** redirect URL for each test client using exactly the origin in `APP_URL` and the path below. Use a dedicated HTTPS test origin for clients that require HTTPS. For an externally reachable preview, turn off `DEV_AUTH` and connect a test email sender before allowing sign-ins.

| Sign-in button | Callback path | Test registration |
| --- | --- | --- |
| Google (Gmail) | `/api/auth/google/callback` | Google web OAuth client, with test users added if required by the consent screen |
| Apple | `/api/auth/apple/callback` | Apple Services ID with Sign in with Apple enabled, Team ID, Key ID and matching private key. Register the test domain and HTTPS return URL. |
| Yahoo | `/api/auth/yahoo/callback` | Yahoo web client with OpenID Connect and email access |
| Microsoft | `/api/auth/microsoft/callback` | Microsoft identity platform web registration for personal Microsoft accounts |

Select a provider, complete sign-in, and confirm the app opens the petition account page. Sign out and repeat with the same provider to check that the same profile returns. Microsoft opens the profile directly using the subject in its signed ID token, including when there is no email claim or a separate petition account has the same email. When Microsoft supplies an address, confirm it appears under **Profile details → Email · private**. For Apple or Yahoo, when asked to connect an account, verify the petition email once in the same browser. On this loopback preview, the email form displays a local verification link when no email sender is configured. Inbox delivery requires a configured sender.

[Google web OAuth](https://developers.google.com/identity/protocols/oauth2/web-server) · [Apple web registration](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web) · [Yahoo OpenID Connect](https://developer.yahoo.com/oauth2/guide/openid_connect/) · [Microsoft web redirect URIs](https://learn.microsoft.com/en-us/entra/identity-platform/reply-url)
