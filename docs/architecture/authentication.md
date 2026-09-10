# Passwordless authentication and administrative access

The implemented foundation supports Google OAuth, email codes, Owner onboarding,
and Owner-issued Admin invitations. No password or password-reset flow exists.
The remaining gym-operation screens are a subsequent phase.

## Configure Supabase and Resend

1. Use asymmetric Supabase Auth signing keys. This project's public JWKS currently
   advertises ES256. Set `SUPABASE_JWT_ALGORITHM=ES256` in the root `.env` (use
   `RS256` only if the project is explicitly configured for it). NestJS derives
   the issuer and JWKS URL from `SUPABASE_URL`; `SUPABASE_JWKS_URL` is not used,
   preventing a separately configured key source from diverging from the issuer.
   Legacy HS256 tokens are intentionally rejected. See
   [Supabase signing keys](https://supabase.com/docs/guides/auth/signing-keys).
2. Enable Google in Supabase Auth and configure the Google client ID/secret there.
   In Google Cloud, register the Supabase callback
   `https://<project-ref>.supabase.co/auth/v1/callback`.
   In Supabase, set the Site URL to the application's origin and allow the exact
   application callbacks `<origin>/auth/callback?next=/admin` and
   `<origin>/auth/callback?next=/invite`. Configure localhost separately for development.
   The application only accepts `/admin` or `/invite` as post-OAuth destinations.
3. Enable email authentication and email confirmation. Set the Magic Link and
   Confirm Signup email templates to show `{{ .Token }}` rather than a clickable
   authentication URL. Paste the template in `docs/auth/email-code.html` into
   both templates. Set OTP length to six digits and expiry to ten minutes;
   retain Supabase's server-side send/verification rate limits. The UI enforces
   a 60-second resend cooldown as a usability measure, not a security boundary.
   See [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates).
4. Verify a sender domain in Resend. Configure Supabase custom SMTP with host
   `smtp.resend.com`, port `465`, username `resend`, and the Resend API key as
   the SMTP password. Use an address on the verified domain as sender. Disable
   email-link tracking for invitation delivery so fragment links remain intact.
   See [Resend SMTP](https://resend.com/docs/send-with-smtp) and
   [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
5. Root `.env`: configure `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`,
   `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_JWT_ALGORITHM`, `WEB_ORIGIN`,
   `RESEND_API_KEY`, and `RESEND_FROM` (for example `Gym <team@your-domain>`).
   `apps/web/.env.local`: configure `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_API_URL`, and `WEB_ORIGIN`.
   `WEB_ORIGIN` must match the browser's exact scheme, hostname, and port in
   both applications. Use HTTPS in production. Never put privileged keys in
   `NEXT_PUBLIC_*` variables. Service-role and secret Supabase keys are not
   needed by this feature.

These dashboard settings require access to the Supabase/Resend project; merely
setting application environment variables does not configure SMTP or Google.

## Database and launch

`node apps/api/scripts/inspect-database.cjs` lists public table names without
printing credentials. The configured Supabase database now uses the public CA in
`apps/api/certs/supabase-ca.crt` with `sslmode=verify-full` and an absolute
`sslrootcert` path in both database URLs. Prisma CLI translates those options to
its strict TLS equivalents. After confirming the public schema was empty, the
authentication migration was applied successfully. Inspect and resolve any
existing schema/baseline before deploying to another database.

After inspection, apply reviewed migrations with
`npm run db:migrate:deploy --workspace=@gym/api`. Build/typecheck regenerate
Prisma; development on a fresh checkout needs
`npm exec --workspace=@gym/api -- prisma generate` before `npm run dev`.

The database connection is a backend-only PostgreSQL role with access to these
tables. Row-level security has no browser policies, blocking direct Supabase
Data API access. NestJS is the authorization boundary for all business records.
Database connectivity remains lazy so `/health` still works without a database;
health does not establish database or authentication readiness.

## Security and behavior

- NestJS checks JWT signatures, issuer, authenticated audience, expiry, subject,
  required claims, exact asymmetric algorithm, and authenticated role. Anonymous
  users and service-role tokens cannot authenticate. JWKS caches for ten minutes,
  with a 30-second unknown-key refresh cooldown and a five-second fetch timeout.
  Publish new keys before switching signing keys. Validation always fails closed.
- Next.js refreshes SSR cookies and performs supplementary route protection.
  The API never trusts browser session data or a client-supplied user ID.
- Onboarding verifies the current email and serializes submissions per user.
  It creates business, branch, Owner access, and audit record atomically. Existing
  users are returned to their business instead of creating duplicates. Each user
  may own one business in this release and administer multiple invited businesses.
- Owner-only invitation endpoints scope every operation to business access.
  Invitations use a 32-byte random base64url token with a seven-day expiry. Only
  its SHA-256 hash is stored; raw tokens appear transiently in the outbound email.
  Resend necessarily receives that email content; the application does not store
  it in delivery metadata, queues, or audit records.
- Invitation links use `/invite#token=...`. The browser removes the fragment and
  keeps the token in tab-scoped sessionStorage during authentication. It is cleared
  on acceptance/cancellation. Use the same browser tab to complete authentication.
- Acceptance sends the token in a POST body. After JWT validation, the API calls
  Supabase `getUser` using the user's bearer token and publishable key, requires
  the same subject and a confirmed email, and matches trim/lowercase normalization
  without alias rewriting. Row locks make acceptance atomic and retry-safe. Existing
  Owner access cannot be downgraded. Resends rotate the hash and revocations take
  effect immediately. Only the accepting user may repeat an accepted request.
- Delivery states are PENDING, SENT (provider accepted), and FAILED. SENT is not
  inbox-delivery confirmation. Resend after a crash or delivery failure rotates
  the token; stale delivery results cannot overwrite a newer invitation version.
- No request-body logger is enabled. Next.js incoming-request logging is disabled
  to avoid logging OAuth codes. Keep reverse-proxy/APM logs from recording callback
  query strings, authorization/cookie headers, OTPs, or acceptance bodies. Do not
  enable session replay on auth pages. API invitation responses omit token hashes.

## REST interfaces

All routes below require `Authorization: Bearer <Supabase user access token>`.
Swagger is served at `/docs`.

| Method and path                                              | Input / behavior                                                           |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| GET `/api/v1/me/businesses`                                  | Current user's business access and branches                                |
| POST `/api/v1/onboarding`                                    | `name`, `branchName`, `currency`, `timezone`; retry-safe business creation |
| GET `/api/v1/businesses/:businessId/invitations`             | Owner-only, latest 100 invitations                                         |
| POST `/api/v1/businesses/:businessId/invitations`            | Owner-only, `email`; create and send                                       |
| POST `/api/v1/businesses/:businessId/invitations/:id/resend` | Owner-only; rotate and send, 60-second cooldown                            |
| POST `/api/v1/businesses/:businessId/invitations/:id/revoke` | Owner-only; invalidate pending invitation                                  |
| POST `/api/v1/invitations/accept`                            | `token`; exact confirmed-email match required                              |

Currency choices are INR, USD, EUR, GBP, and AED; defaults are INR and
Asia/Kolkata. Timezones use IANA identifiers. Staff records and member accounts
are not part of this authentication phase.

## Validation

- `npm run test:auth`: JWT/signature/claim rejection, JWKS caching/rotation,
  configuration failure, and token generation tests.
- `npm run test:integration`: real NestJS HTTP and Prisma/PostgreSQL workflows.
  Set `TEST_DATABASE_URL` to a **fresh, disposable local database** whose name
  contains `auth_test`. This suite creates the schema and refuses remote targets;
  without the variable it is reported as skipped. Use a new database each run.
- `npm run test:e2e:auth`: Chromium OTP/error/resend, Google PKCE callback,
  onboarding, Owner invitation, wrong-account rejection, acceptance, reload,
  and cancellation coverage. Requires a separate fresh `auth_test` database and
  free ports 3100–3102. Uses a local Supabase simulator and in-memory mail capture;
  no test emails are sent. Fixture services are never imported by the application.
- `npm run test:e2e`: default sign-in/health smoke tests.
- `npm run lint`, `npm run typecheck`, `npm run build`,
  `npm run prisma:validate --workspace=@gym/api`, `npm run format:check`.

Live JWKS discovery, remote database connectivity, and migration deployment were
checked. Live Google consent, real email-code delivery, and invitation email
delivery still need verification. Automated provider fixtures
validate the application flows, not external account configuration.
