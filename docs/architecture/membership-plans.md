# Phase 5: Membership Plan Management

Implemented on 8 September 2026. Owners and Admins can create, search, inspect, edit, deactivate/reactivate, and archive business-owned plans through the existing Admin shell and NestJS API. PostgreSQL persists plans and selected branch relationships. Member assignment and payments remain future modules; member and revenue summary values are zero.

## Schema and migration

`MembershipPlan` uses the existing UUID strategy and contains businessId, name, optional description, integer priceMinor and durationDays, appliesToAllBranches, status, createdAt, updatedAt, and optional archivedAt. `MembershipPlanStatus` is ACTIVE, INACTIVE, or ARCHIVED. Business owns plans; Branch has reverse plan assignments.

`PlanBranchAssignment` contains planId, branchId, and createdAt, with a composite primary key and relational foreign keys. No branch IDs are stored as JSON. Indexes support business/status listing and reverse branch lookup. Foreign keys restrict deletion. Database checks enforce price/duration ranges and consistent archive status/timestamps.

Migration `202609080005_membership_plans` creates only the new enum, tables, constraints, and indexes, in a transaction. It enables row-level security on both new tables without browser access policies, matching the existing API-only access pattern.

The configured Supabase database was inspected before deployment. After local migration and integration tests, `prisma migrate deploy` applied the migration. Before/after row counts and content digests verified preservation of Business (1), Branch (1), Staff (0), StaffBranchAssignment (0), BusinessAccess (1), Invitation (2), and AuditEvent (5). No record contents or credentials were printed. A separate migration test seeds pre-existing Staff, assignments, access, invitations, and audit records and compares every row after migration. Both new tables have RLS enabled. Prisma's comparison with the configured database reports no difference.

## API and UI

All API paths begin with `/api/v1/businesses/:businessId/membership-plans`:

| Method | Suffix             | Behavior                                        |
| ------ | ------------------ | ----------------------------------------------- |
| GET    | empty              | Search, status/branch filters, pagination       |
| POST   | empty              | Create a plan                                   |
| GET    | `/:planId`         | Detail, eligible branches, zero summary metrics |
| PATCH  | `/:planId`         | Edit operational plans                          |
| POST   | `/:planId/archive` | Archive with retry-safe repeated requests       |

List defaults are status ACTIVE, page 1, pageSize 20. Status also accepts INACTIVE, ARCHIVED, and ALL. Search matches the plan name case-insensitively. Branch filters include all-branch plans and explicitly assigned plans for the selected active branch. Page size is capped at 100. Names need not be unique, including across businesses.

UI routes:

- `/admin/membership-plans`
- `/admin/membership-plans/new`
- `/admin/membership-plans/[planId]`
- `/admin/membership-plans/[planId]/edit`

The list uses a desktop table and mobile cards. Forms use React Hook Form/Zod, duration presets, a read-only business currency, and a branch multi-select. Detail provides Overview and a future Members placeholder. Loading, empty, validation, unavailable API, retry, not-found, inactive, and archived states are handled. Archive requires the specified confirmation text. TanStack Query hooks centralize requests and invalidate plan/detail/dashboard queries after mutations; branch changes also invalidate plan queries.

## Domain behavior

Money is stored as an integer in minor units: `1200.00` becomes `120000`, and `1200.29` becomes `120029`. The reusable parser converts decimal text with BigInt arithmetic before producing the integer API value. It never multiplies a floating-point decimal to calculate stored money. Formatting and edit-field conversion are centralized in `packages/validation/src/money.ts`. The formatter uses Intl for presentation only. Current business currencies INR, USD, EUR, GBP, and AED all use two minor-unit digits; plans have no configurable currency of their own.

Frontend and backend require a positive price, capped at 1,000,000,000 minor units (10,000,000 major units). The API rejects fractional, string, null, zero, negative, and oversized priceMinor values. Decimal input rejects more than two decimal places, exponents, and grouped numbers. Duration is an integer from 1 to 3650 calendar days. Presets are 30, 90, 180, and 365; no start/end dates are calculated.

All-branch plans store `appliesToAllBranches = true` and no explicit assignments. Their eligible branches are resolved from current active business branches, so newly created active branches are included automatically. Selected-branch plans require at least one explicit branch. New assignments must reference active branches in the same business. If a previously assigned branch is archived, the relationship may remain for history but is excluded from eligibility. Existing archived relationships can be retained during edits; they cannot be newly selected. Switching to all branches removes explicit assignments.

ACTIVE plans expose currently eligible branches. INACTIVE plans remain editable and may be reactivated, but expose no eligible branches. ARCHIVED plans expose no eligible branches, retain their records/relationships, and are read-only. Archive sets archivedAt and removes the plan from the default list. There is no delete or restore endpoint. Repeated archive requests return the same archive state without duplicate archive audit events.

**Future membership rule:** membership creation must snapshot the agreed plan name, price, and duration. Editing a plan must never rewrite historical membership terms. The future assignment transaction must recheck the plan's ACTIVE status, business ownership, active branch status, and applicability. Snapshot and assignment implementation is outside Phase 5.

## Authorization and audit

Every endpoint reuses the existing Supabase JWT/JWKS AuthGuard. NestJS resolves Owner/Admin business access from the verified user subject. Plan lookups include both plan ID and business ID. Referenced branches and branch filters are independently checked for business ownership. Foreign-business requests, forged business/plan pairs, and new archived-branch assignments are rejected. Client-provided currency and other unknown fields are rejected by the existing strict validation pipe.

Writes and their audit events are transactional. The business row is locked using the same convention as Branch Management to serialize plan applicability changes with branch archival. Existing passwordless authentication, invitation-token hashing, and verified-email acceptance behavior are reused without weakening their checks.

Events are MEMBERSHIP_PLAN_CREATED, MEMBERSHIP_PLAN_UPDATED, and MEMBERSHIP_PLAN_ARCHIVED. targetId contains the plan ID and metadata contains only `{ planName }`. Dashboard Recent Activity renders these events. Request payloads, prices, credentials, and tokens are not added to audit metadata.

## File inventory

Created:

```text
apps/api/prisma/migrations/202609080005_membership_plans/migration.sql
apps/api/src/modules/membership-plans/membership-plans.controller.ts
apps/api/src/modules/membership-plans/membership-plans.dto.ts
apps/api/src/modules/membership-plans/membership-plans.module.ts
apps/api/src/modules/membership-plans/membership-plans.service.ts
apps/web/app/admin/membership-plans/page.tsx
apps/web/app/admin/membership-plans/new/page.tsx
apps/web/app/admin/membership-plans/[planId]/page.tsx
apps/web/app/admin/membership-plans/[planId]/edit/page.tsx
apps/web/features/membership-plans/archive-plan-dialog.tsx
apps/web/features/membership-plans/branch-applicability-selector.tsx
apps/web/features/membership-plans/plan-detail.tsx
apps/web/features/membership-plans/plan-form.tsx
apps/web/features/membership-plans/plan-list.tsx
apps/web/features/membership-plans/plan-schema.ts
apps/web/features/membership-plans/plan-shared.tsx
apps/web/features/membership-plans/use-membership-plans.ts
packages/types/src/membership-plans.ts
packages/validation/src/money.ts
packages/validation/test/money.test.cjs
e2e/auth/membership-plans.spec.ts
docs/architecture/membership-plans.md
```

Modified:

```text
apps/api/prisma/schema.prisma
apps/api/src/app.module.ts
apps/api/src/modules/dashboard/dashboard.service.ts
apps/api/test/auth.integration.test.cjs
apps/api/test/browser-fixture.cjs
apps/web/components/layout/admin-navigation.ts
apps/web/features/admin/admin-context.tsx
apps/web/features/branches/use-branches.ts
packages/types/src/index.ts
packages/validation/src/index.ts
package.json
README.md
docs/architecture/README.md
```

The former Membership Plans placeholder route is now connected. Prisma client was regenerated. No dependencies were added.

## Verification

New API assertions cover all 17 requested cases: Owner/Admin creation, exact persisted minor units, invalid amounts/durations, all/selected branches, foreign/archived branch rejection, detail, edits, applicability changes, archive/default filtering, cross-business access, forged IDs, and repeated names across businesses. Additional checks cover dynamic new branches, archived branch history, inactive eligibility/reactivation, pagination, null/unknown-field rejection, idempotent archive, no delete route, zero metrics, safe audit metadata, and dashboard activity.

Two new browser workflows cover all 13 requested scenarios, including desktop Owner all-branch creation, mobile Admin selected-branch creation, list/detail, price/duration and applicability editing, inactive/reactivation, archive/history/reload, validation, branch/search filters, and recoverable create/list API failures. Existing authentication, dashboard, branch, and staff browser workflows pass. Money unit tests exercise exact decimal conversions, round trips, formatting, and invalid precision.

| Check                                 | Result                                        |
| ------------------------------------- | --------------------------------------------- |
| `npm run lint`                        | Pass                                          |
| `npm run typecheck`                   | Pass                                          |
| `npm run build`                       | Pass                                          |
| Prisma validation                     | Pass                                          |
| Configured database schema comparison | No difference detected                        |
| Migration                             | Applied to configured Supabase database       |
| `npm run test:auth`                   | 4 pass                                        |
| `npm run test:money`                  | 2 pass                                        |
| `npm run test:integration`            | 11 pass, no skips (includes suite container)  |
| `npm run test:e2e`                    | 3 smoke tests pass                            |
| `npm run test:e2e:auth`               | 11 workflows pass, including 2 plan workflows |

API and browser workflows use isolated local PostgreSQL and a local Supabase simulator. Live Google consent and Resend delivery were not reverified in Phase 5. Screenshots are in `test-results/auth-browser/plan-detail-desktop.png` and `test-results/auth-browser/plan-form-mobile.png`.

Development servers were restarted after the production build. Readiness checks returned 200 for API health and sign-in, 307 to sign-in for an unauthenticated plan page, and 401 for an unauthenticated plan API request. The local PostgreSQL test service was stopped; runtime uses the configured Supabase database.
