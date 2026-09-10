# Phase 3: Branch Management

Branch Management is connected to PostgreSQL through the existing authenticated NestJS API. The existing Admin shell, dashboard, and passwordless authentication are reused. No Member, Staff, Membership, Payment, Attendance, QR, or Report workflows were added.

## Routes and API

| UI route                          | Purpose                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `/admin/branches`                 | Active list by default; search, status filter, pagination, mobile cards |
| `/admin/branches/new`             | Create a branch with required address details                           |
| `/admin/branches/[branchId]`      | Real branch information, overview, edit/archive actions                 |
| `/admin/branches/[branchId]/edit` | Edit an active branch                                                   |

All API paths begin with `/api/v1/businesses/:businessId/branches`:

| Method | Suffix               | Permission                              |
| ------ | -------------------- | --------------------------------------- |
| GET    | (none)               | Owner/Admin: list                       |
| POST   | (none)               | Owner/Admin: create                     |
| GET    | `/:branchId`         | Owner/Admin: detail, including archived |
| PATCH  | `/:branchId`         | Owner/Admin: update active branch       |
| POST   | `/:branchId/archive` | Owner only: archive                     |

List accepts `search` (name, code, address line 1, city, state, country, postal code), `status=ACTIVE|ARCHIVED|ALL` (default ACTIVE), `page` (default 1), and `pageSize` (default 20, maximum 100). Results contain `items`, `total`, `page`, and `pageSize`. Swagger documents endpoints, DTOs, and filters.

## Data and rules

Migration `202609070002_branch_management` extends Branch with a per-business unique code, contact and address fields, optional timezone override, ACTIVE/ARCHIVED status, and creation/update/archive timestamps. AuditEvent gains optional JSON metadata. The migration runs transactionally and has been applied to the configured Supabase database with verified TLS.

The existing branch's ID, name, and business ownership were compared before and after deployment and preserved. Legacy branches receive deterministic per-business codes (`BR0001`, etc.); their missing address/contact data remains null. Their new creation/update timestamps represent migration time because the previous schema had no timestamps. Editing through the complete form requires filling missing required address fields.

New branch forms require name, address line 1, city, state, country, and string postal code. Country defaults to India but accepts other countries. Codes are trimmed and uppercased and must contain 2–20 letters, numbers, hyphens, or underscores. Omitted codes are generated server-side (`BR0002`, etc.), with collision checks and a unique database index. A database-generated `BR-` code supports existing onboarding's name-only initial branch creation. Currency remains on Business. A null/blank timezone inherits the business timezone; overrides must be valid IANA timezones.

Every endpoint uses the existing JWT/JWKS guard, checks business access, and scopes branch lookup to the requested business. Client-supplied ownership/status fields are rejected. A centralized role check permits only Owner/Admin branch access, with an additional Owner check for archive.

Branch writes lock the business row within a transaction. This serializes concurrent archive/create operations and ensures at least one active branch remains. The final archive returns HTTP 409 with code `LAST_ACTIVE_BRANCH` and a user-facing explanation. Duplicate codes return `DUPLICATE_BRANCH_CODE`; editing archived branches returns `BRANCH_ARCHIVED`. Archive retries are idempotent and produce only one archive audit event. No delete or restore endpoint exists.

Archived branches remain available through detail and archived/all filters but are read-only and excluded from the global active selector and dashboard branch scope. Future operational modules must enforce ACTIVE status in the same transaction as creating memberships/check-ins; those modules are outside this phase.

TanStack Query mutations invalidate branch lists, details, business access, and dashboard queries. The shell refreshes names/options and removes `branchId` from the URL when the current selection is archived. Branch management lists all branches in the current business; the global operational branch filter does not conceal other locations from management. Switching businesses from a branch detail/form returns to that business's list.

## Audit and metrics

`BRANCH_CREATED`, `BRANCH_UPDATED`, and `BRANCH_ARCHIVED` are recorded atomically with changes. Audit records contain business, actor, branch target ID, action, timestamp, and only `{ branchName }` as metadata. Contact/address payloads and credentials are not audited. Dashboard Recent Activity renders the action and branch name within its existing business scope.

Branch details, contacts, addresses, status, timezone, dates, list totals, and audit activity are real database data. Member/staff counts and all six operational overview metrics deliberately return zero; amounts use the business currency. Future sections show their unavailable state. No fake operational data is seeded.

## File inventory

Created:

```text
apps/api/prisma/migrations/202609070002_branch_management/migration.sql
apps/api/src/modules/branches/branches.controller.ts
apps/api/src/modules/branches/branches.dto.ts
apps/api/src/modules/branches/branches.module.ts
apps/api/src/modules/branches/branches.service.ts
apps/web/app/admin/branches/page.tsx
apps/web/app/admin/branches/new/page.tsx
apps/web/app/admin/branches/[branchId]/page.tsx
apps/web/app/admin/branches/[branchId]/edit/page.tsx
apps/web/features/branches/archive-branch-dialog.tsx
apps/web/features/branches/branch-detail.tsx
apps/web/features/branches/branch-form.tsx
apps/web/features/branches/branch-list.tsx
apps/web/features/branches/branch-schema.ts
apps/web/features/branches/branch-shared.tsx
apps/web/features/branches/use-branches.ts
packages/types/src/branches.ts
e2e/auth/branches.spec.ts
docs/architecture/branch-management.md
```

Modified:

```text
apps/api/prisma/schema.prisma
apps/api/src/app.module.ts
apps/api/src/main.ts
apps/api/src/modules/auth/business.service.ts
apps/api/src/modules/dashboard/dashboard.service.ts
apps/api/test/auth.integration.test.cjs
apps/api/test/browser-fixture.cjs
apps/web/components/layout/admin-navigation.ts
apps/web/components/layout/admin-topbar.tsx
apps/web/features/admin/admin-context.tsx
apps/web/lib/api/auth-api.ts
packages/types/src/index.ts
README.md
docs/architecture/README.md
```

Prisma's generated client is regenerated from the schema. No new dependencies are required.

## Validation

API integration coverage adds legacy migration preservation, Owner/Admin creation and editing, generated codes and uniqueness, different-business reuse, forged IDs/cross-business read/update/archive rejection, input validation, timezone inheritance, pagination/search/filtering, archive history/read-only behavior, Admin archive denial, safe audit metadata, dashboard activity, idempotent archive, final-active rejection, and concurrent archive protection.

Playwright covers list/create/detail/edit/archive, selector creation/rename/removal, clearing an archived selection from the URL, archived history after reload, form validation, duplicate-code recovery, search/empty states, mobile layout, unavailable API/retry, Admin actions, and the preserved dashboard/authentication workflows. Authentication browser tests use a local Supabase simulator with real NestJS/PostgreSQL. Live Google consent and actual Resend delivery were not retested in this phase.

Run `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:auth`, `npm run test:e2e`, and `npm run prisma:validate --workspace=@gym/api`. Run `npm run test:integration` and `npm run test:e2e:auth` with separate fresh local `TEST_DATABASE_URL` databases whose names contain `auth_test`. Both fixtures now apply every migration in order.

Validated on 7 September 2026:

| Check | Result |
| --- | --- |
| Lint | Pass |
| Typecheck, including browser tests | Pass |
| Production build | Pass |
| Prisma validation | Pass |
| Configured Supabase migration status | Up to date; both migrations applied |
| Prisma schema comparison against configured database | No difference detected |
| Authentication tests | 4 pass |
| API/migration integration tests | 9 pass, no skips (includes suite container) |
| Default Playwright smoke tests | 3 pass |
| Authenticated Playwright workflows | 7 pass, including 2 new branch workflows |

Desktop detail and mobile form/list screenshots are available in `test-results/auth-browser`. Development servers were restarted on ports 3000 and 3001 after validation.
