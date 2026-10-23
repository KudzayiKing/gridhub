# Google authentication

Gridhub uses Supabase Auth with Google as the only provider. There are no passwords in
this product — no password reset flow, no password hashing to get wrong.

## 1. Create the OAuth client

In [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

1. Create or select a project.
2. **OAuth consent screen** — External, app name "Gridhub", your support email, scopes
   `openid`, `email`, `profile`. Add test users while in Testing mode.
3. **Create credentials → OAuth client ID → Web application**.
4. Authorised JavaScript origins:
   - `http://localhost:3000`
   - `https://gridhub.online`
5. Authorised redirect URIs — this must be the **Supabase** callback, not your app:
   - `https://nzcwmarlkdmgssrllsqn.supabase.co/auth/v1/callback`

### Consent-screen links

The consent screen will not save without two public URLs. Both pages already exist in this
repo and are public (not behind auth):

| Field | URL | Source |
| --- | --- | --- |
| Application privacy policy link | `https://gridhub.online/privacy` | `app/privacy/page.tsx` |
| Application terms of service link | `https://gridhub.online/terms` | `app/terms/page.tsx` |

Google fetches these to verify they resolve, so **the domain must be live before the consent
screen can be saved**. Deploy first, confirm both return 200, then fill these in.

A common failure: pasting `https://gridhub.online/auth/callback` into Google. Google redirects
to Supabase, Supabase redirects to your app. Putting the app URL in Google's list means the
code exchange never happens.

## 2. Enable it in Supabase

**Authentication → Providers → Google**: enable, paste the Client ID and Client Secret, save.

Then **Authentication → URL Configuration**:

| Field | Development | Production |
| --- | --- | --- |
| Site URL | `http://localhost:3000` | `https://gridhub.online` |
| Redirect URLs | `http://localhost:3000/auth/callback` | `https://gridhub.online/auth/callback` |

Supabase only redirects to URLs on this list. A missing entry is the single most common
"sign-in does nothing" cause.

## 3. How the flow runs

```
Browser                     Supabase                     Google
   │  signInWithOAuth          │                            │
   ├──────────────────────────►│  redirect                  │
   │                           ├───────────────────────────►│  consent
   │                           │◄───────────────────────────┤  code
   │◄──────────────────────────┤  redirect ?code=...        │
   │  GET /auth/callback?code  │                            │
   ├──────────────────────────►│  exchangeCodeForSession    │
   │◄──────────────────────────┤  session cookies           │
   │  redirect /onboarding or /app                          │
```

Implementation notes:

- The client calls `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } })`
  with `redirectTo` built from the current origin plus `/auth/callback`, so the same code
  works on localhost and production without a rebuild.
- `app/auth/callback/route.ts` calls `exchangeCodeForSession(code)` — PKCE, handled by
  `@supabase/ssr`.
- It then upserts the `profiles` row and checks `user_preferences`. No row → `/onboarding`;
  row → `/app`.
- `middleware.ts` refreshes the session cookie on every request to `/app`, `/admin` and
  `/onboarding`, and redirects a signed-in user away from `/login`.

## 4. Session handling

`@supabase/ssr` stores the session in cookies so server components can read it. The
middleware refresh is not optional: without it, an access token that expires while the tab
is idle produces a signed-out state mid-session.

`lib/supabase/server.ts` wraps the cookie writes in a `try/catch`, because a Server Component
cannot set cookies. In that case the middleware has already refreshed them — the catch is
expected, not an error to log.

## 5. Local-only mode

With no Supabase env vars, `/login` renders a "Continue in local mode" path instead of the
Google button. The workspace is fully usable; data stays in IndexedDB; billing and admin are
disabled with explicit notices. This is the intended evaluation path, not a broken state.

## 6. Account deletion

`POST /api/account/delete` verifies the session, then calls
`service.auth.admin.deleteUser(user.id)`. Every customer table cascades from `auth.users`, so
one call removes the profile, workspaces, preferences, billing rows and all tool data.

Stripe invoices are **not** deleted — they are Stripe's record of a financial transaction.
The endpoint's response says so, and the settings UI repeats it before the user confirms.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `redirect_uri_mismatch` from Google | Google's authorised redirect URI must be the Supabase `/auth/v1/callback` |
| Returns to `/login` with no error | `/auth/callback` missing from Supabase redirect allowlist |
| Signs in, loops back to `/login` | Cookies blocked, or the site is served over a different origin than configured |
| Works on desktop, not on mobile PWA | The installed PWA has its own cookie jar; open the flow in the browser first, then install |
| `Email not confirmed` | Google returns verified email; if this appears, the provider is not actually Google |
