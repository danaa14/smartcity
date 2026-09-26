# Account menu and Google sign-in

The header drawer reuses LangProvider/LangSwitch and the existing chat renderer. It uses a native modal dialog for focus containment, Escape and focus restoration, a right-edge animation, an overlay, scroll locking and reduced-motion support.

## Deployment

Set server-only environment variables in Vercel: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET (generate with `openssl rand -base64 32`), and NEXTAUTH_URL=https://smartcity-alpha.vercel.app. Never use NEXT_PUBLIC_ for these values. Configure a Google OAuth Web application with redirect URI `https://smartcity-alpha.vercel.app/api/auth/callback/google` (locally `http://localhost:3100/api/auth/callback/google`). Configure the consent screen and test users as appropriate, then redeploy.

NextAuth handles Google authorization code exchange, PKCE, state, CSRF protection and encrypted HttpOnly session cookies. Only Google with a verified email is accepted. Provider access/refresh tokens are not exposed in the client session. The Google subject becomes the stable account ID. Missing credentials show an inline unavailable state; real OAuth completion requires configured credentials and a consenting Google account.

## History and database integration

`src/lib/chat/types.ts` defines versioned Conversation/SavedTurn records and the ConversationRepository boundary. The current adapter saves up to 50 conversations in this browser, scoped to guest or the authenticated Google subject. Local storage is device storage, not a secure server database or cross-device sync. Accounts do not automatically inherit guest chats. Logging out/remounting the account provider removes the previous account's active conversation from the UI.

Text answers retain their full Answer payload, including sources, for the existing AnswerView. Completed document turns retain their confirmed redacted context and summary, not the original File. Unprocessed uploads and live voice audio are not persisted. Continuing a restored chat rebuilds model context from saved messages. Storage errors are shown in the drawer.

For server persistence, replace the repository with an asynchronous API adapter and add loading/error states to the provider. Authenticate every endpoint using getServerSession(authOptions), derive ownerId on the server, validate payloads, and scope all queries by that ID. Do not trust ownerId sent by the browser. Use a durable database rather than the prototype's JSON filesystem on Vercel. Add retention/deletion controls before collecting production chat records.

## Verification

`npm run build`

`node scripts/test-account-menu.mjs` with the development server on port 3105, or set TEST_BASE_URL. Tests cover desktop/mobile widths, language changes, overlay/Escape dismissal, focus restoration, restored messages, new conversation and missing OAuth configuration. The auth fallback assertion expects no Google credentials. Screenshots are written to artifacts/.

## Configured local Google login (2026-09-26)

Google Cloud project: `smartcity-509817`. The local server now loads the Google OAuth credentials and a generated session secret from ignored `.env.local` (owner-only permissions). NEXTAUTH_URL is currently `http://localhost:3105`, matching the running preview. If using `npm run dev` on port 3100 instead, change that value to `http://localhost:3100`.

The selected Google Web client has these callback URLs:
- `http://localhost:3105/api/auth/callback/google`
- `http://localhost:3100/api/auth/callback/google`
- `https://smartcity-alpha.vercel.app/api/auth/callback/google`

Verified a real Google authorization-code exchange, account name/photo display in the drawer, and authenticated session persistence after a full page reload. No credentials are stored in this documentation or in frontend code.

The live Vercel deployment still needs its own server environment values and deployment of this updated project. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to the configured client, generate a separate NEXTAUTH_SECRET, and set NEXTAUTH_URL to the production origin. The Google app remains in testing mode; check its Audience settings before enabling public access.
