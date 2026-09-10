# Gym SaaS

An npm-workspaces/Turborepo gym application with a Next.js frontend, NestJS API and PostgreSQL. Connected workflows include authentication, branch and member management, staff, membership plans, memberships, payments and dues, attendance, QR registration, the member portal, reports and Owner-managed Admin access.

See the [admin product audit](docs/architecture/admin-product-audit.md) for the latest branch-scoping fixes, deployed migrations, verification and remaining product boundaries. Earlier phase reports describe the historical implementation stages.

## Getting started

Use Node.js 22.12+ (24 recommended) and npm 11.

```sh
npm ci
npm exec --workspace=@gym/api -- prisma generate
npm run dev
```

- Frontend/sign-in: http://localhost:3000/sign-in
- Owner/Admin dashboard: http://localhost:3000/admin/dashboard
- Existing Admin invitation management: http://localhost:3000/admin/settings/access
- API health: http://localhost:3001/health
- Swagger: http://localhost:3001/docs
- OpenAPI: http://localhost:3001/docs-json

Run applications independently with `npm run dev:web` and `npm run dev:api`.
After building, use `npm start --workspace=@gym/web` and
`npm start --workspace=@gym/api` in separate terminals.

## Configuration and database

Copy the root `.env.example` to `.env`, and `apps/web/.env.example` to
`apps/web/.env.local`, preserving existing credentials. Follow the
[authentication setup guide](docs/architecture/authentication.md) for Google
callbacks, asymmetric signing keys, OTP templates, Resend SMTP, and sender setup.

NestJS authenticates user access tokens using JWT/JWKS validation. It does not use
service-role keys as user authentication. Invitation tokens are stored only as
SHA-256 hashes; acceptance requires the matching confirmed email.

The migration is in `apps/api/prisma/migrations` and has been applied to the
configured Supabase database. Its TLS connection uses the public CA certificate
in `apps/api/certs` with full verification. For another database, inspect its
schema and establish any necessary baseline before deploying:

```sh
node apps/api/scripts/inspect-database.cjs
npm run prisma:validate --workspace=@gym/api
npm run db:migrate:status --workspace=@gym/api
# Apply only after inspecting the target schema:
npm run db:migrate:deploy --workspace=@gym/api
```

Prisma CLI uses `DIRECT_URL`; runtime uses `DATABASE_URL` through the PostgreSQL
adapter. Use SSL remotely. Database access is lazy: `/health` does not establish
database or authentication readiness.

## Validation

```sh
npm run lint
npm run typecheck
npm run build
npm run format:check
npm run test:auth
npm run test:money
npm run test:member-profile
npm run test:e2e
```

Integration and browser workflows each require a separate **fresh local**
PostgreSQL database with `auth_test` in its name. Set `TEST_DATABASE_URL`, then run:

```sh
npm run test:integration
npm run test:e2e:auth
```

These suites create their schema without dropping existing data and reject remote
targets. Integration tests report skipped without the variable; browser tests
require it. Use a new database for each run. Browser tests use a local Supabase
simulator, real NestJS/PostgreSQL, and in-memory email capture on ports 3100–3102;
no real emails are sent.

Default Playwright smoke tests reuse or start servers on ports 3000/3001. Install
Chromium when needed with `npx playwright install chromium`. Generated artifacts
are ignored. Live Google consent and email delivery require separate verification.

## Structure

- `apps/web`: SSR sessions, authentication UI, onboarding, Admin invitations.
- `apps/api`: JWT guard, business authorization, Resend, Prisma, integration tests.
- `packages/*`: shared UI/types/validation/configuration boundaries.
- `e2e`: smoke tests and isolated authentication browser workflows.
- `docs`: architecture and provider setup instructions.

See [architecture boundaries](docs/architecture/README.md).

Phase 3 Branch Management is implemented: connected branch listing, creation,
editing, and Owner-only archiving. See the [branch implementation report](docs/architecture/branch-management.md)
for routes, permissions, migration compatibility, file inventory, and test coverage.

Phase 4 [Staff Management](docs/architecture/staff-management.md) adds employee records,
multiple branch assignments, staff archival, and real dashboard/branch staff counts.
Employment records remain separate from administrative login access.

Phase 5 [Membership Plan Management](docs/architecture/membership-plans.md) adds connected
plan creation, editing, branch applicability, inactive status, and archival.
Prices use integer minor units and plans use the business currency.

Phase 6 [Member Management](docs/architecture/member-management.md) adds business-owned
profiles, generated member numbers, duplicate-phone checks, archival, and real
Dashboard member totals. Photo uploads are deferred; member authentication and
membership assignment remain future phases.

The existing dependency tree reports four high-severity audit entries in Prisma's
dependencies. No forced major-version audit fix was applied in this feature.
