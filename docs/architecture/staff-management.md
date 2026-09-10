# Phase 4: Staff Management

Staff Management uses the existing passwordless authentication, NestJS business authorization, Admin shell, and PostgreSQL database. A Staff record is an employment record; creating one never creates a Supabase user, BusinessAccess record, or invitation. Job titles carry no login permissions.

## UI and API

| UI route                      | Behavior                                                                  |
| ----------------------------- | ------------------------------------------------------------------------- |
| `/admin/staff`                | Active by default; search, title/status filters, pagination, mobile cards |
| `/admin/staff/new`            | Personal, employment, branch assignment, and additional details           |
| `/admin/staff/[staffId]`      | Staff overview, assigned branches, contact information, notes             |
| `/admin/staff/[staffId]/edit` | Edit non-archived staff and branch assignments                            |

All REST paths begin with `/api/v1/businesses/:businessId/staff`. Owner and Admin can use every endpoint:

| Method | Suffix              | Behavior                                                                 |
| ------ | ------------------- | ------------------------------------------------------------------------ |
| GET    | (none)              | List with `search`, `jobTitle`, `status`, `branchId`, `page`, `pageSize` |
| POST   | (none)              | Create staff with one or more active branch assignments                  |
| GET    | `/:staffId`         | Read active, inactive, or archived staff                                 |
| PATCH  | `/:staffId`         | Update non-archived staff                                                |
| POST   | `/:staffId/archive` | Archive with historical records preserved                                |

List status defaults to ACTIVE; INACTIVE, ARCHIVED, and ALL are also accepted. Search matches name, phone, or email; job title uses case-insensitive equality. The global branch selector filters the staff list. Pagination defaults to 20 records and allows up to 100 per page. The API validates branch filter ownership, including archived branches queried directly for history. Swagger documents the routes and DTOs.

## Schema and migrations

`Staff` belongs to one Business and contains: UUID id/businessId, fullName, phone, optional email, jobTitle, optional gender/dateOfBirth, joiningDate, optional address/emergencyContactName/emergencyContactPhone, ACTIVE/INACTIVE/ARCHIVED status, optional notes, createdAt/updatedAt, and optional archivedAt. Joining date and birth date use PostgreSQL DATE and travel as `YYYY-MM-DD`, avoiding timezone shifts. Phone numbers are strings. Email/phone are not unique identifiers: shared contact details are allowed.

`StaffBranchAssignment` is a relational join table with staffId, branchId, and createdAt. Its composite primary key prevents duplicate assignments. Foreign keys preserve parent referential integrity, with indexes for business/status/title and branch counts. Staff's archive check constraint keeps status and archivedAt consistent.

Migrations applied to the configured Supabase database:

- `202609070003_staff_management`: Staff and assignment tables, enum, indexes, foreign keys, archive constraint.
- `202609080004_staff_api_access`: row-level security on both new tables, matching the existing API-only database boundary. No browser-access policies are granted.

The additive migration preserved the existing business, branch, and access identities. It created no sample staff or assignments. Prisma's schema comparison reports no differences against the configured database. Database migration and application connections retain verified TLS.

## Assignment, archive, and security rules

Every request passes through JWT/JWKS verification and a database business-access lookup. Staff lookup is scoped by business and staff ID. Referenced branches must exist in the same business; foreign/missing IDs are rejected before any mutation. DTOs reject ownership changes, unexpected fields, invalid UUIDs, empty/duplicate assignment arrays, invalid dates, and unsupported status values.

Staff writes use the same business-row lock as branch writes, so branch archival and staff assignment validation serialize. Newly assigned branches must be ACTIVE. An assignment that predates branch archival can remain when staff details are edited. Unchanged assignment rows retain their original creation timestamp; only removed links are deleted and only new links are inserted. The form shows archived assignments as retained and disabled while allowing active branch selections to change.

Both Owner and Admin may archive staff through a confirmation dialog. Archive changes status and archivedAt without deleting the Staff or its remaining assignment rows. Repeated archive requests are safe and generate one archive event. Archived staff are read-only and excluded from default active lists and active staff counts. There is no delete or restore endpoint.

Audit events STAFF_CREATED, STAFF_UPDATED, and STAFF_ARCHIVED are transactionally recorded with branch-independent target staff ID and only `{ staffName }` as metadata. Phone, email, DOB, address, emergency contacts, and notes are excluded from audit metadata. Dashboard Recent Activity renders these events.

## Count integration

The dashboard's Active Staff card counts unique ACTIVE Staff records for the selected business. Selecting a branch restricts that count to active staff assigned to the branch. A person assigned to two branches counts once in the business total and once in each branch's count. Business totals include active staff whose branch was subsequently archived; branch selectors continue to offer active branches only.

Branch list Staff counts and branch detail Staff cards now query real active assignments. Inactive and archived staff do not contribute. All unrelated future metrics remain zero; no salary, trainer, or attendance metrics were added. Staff mutations invalidate staff lists/details, branch lists/details, and dashboard queries. Branch changes also invalidate staff caches so renamed or archived branches are reflected in employment records.

## File inventory

Created:

```text
apps/api/prisma/migrations/202609070003_staff_management/migration.sql
apps/api/prisma/migrations/202609080004_staff_api_access/migration.sql
apps/api/src/modules/staff/staff.controller.ts
apps/api/src/modules/staff/staff.dto.ts
apps/api/src/modules/staff/staff.module.ts
apps/api/src/modules/staff/staff.service.ts
apps/web/app/admin/staff/page.tsx
apps/web/app/admin/staff/new/page.tsx
apps/web/app/admin/staff/[staffId]/page.tsx
apps/web/app/admin/staff/[staffId]/edit/page.tsx
apps/web/features/staff/archive-staff-dialog.tsx
apps/web/features/staff/branch-assignment-selector.tsx
apps/web/features/staff/staff-detail.tsx
apps/web/features/staff/staff-form.tsx
apps/web/features/staff/staff-list.tsx
apps/web/features/staff/staff-schema.ts
apps/web/features/staff/staff-shared.tsx
apps/web/features/staff/use-staff.ts
packages/types/src/staff.ts
e2e/auth/staff.spec.ts
docs/architecture/staff-management.md
```

Modified:

```text
apps/api/prisma/schema.prisma
apps/api/src/app.module.ts
apps/api/src/modules/branches/branches.service.ts
apps/api/src/modules/dashboard/dashboard.service.ts
apps/api/test/auth.integration.test.cjs
apps/api/test/browser-fixture.cjs
apps/web/components/layout/admin-navigation.ts
apps/web/features/admin/admin-context.tsx
apps/web/features/branches/branch-detail.tsx
apps/web/features/branches/use-branches.ts
apps/web/features/dashboard/dashboard-metrics.tsx
packages/types/src/index.ts
README.md
docs/architecture/README.md
```

Prisma client was regenerated; no dependencies were added. Payroll, staff login roles, shifts, leave, trainer/member assignment, Members, and Membership modules remain out of scope.

## Verification

API integration tests cover Owner/Admin CRUD, one and multiple assignments, changes to assignments and status, cross-business/forged identifiers, input validation, archived branch rejection, retention after branch archival, original assignment timestamps, staff archival/read-only history, active-count deduplication, safe audit events, and absence of a delete endpoint. Migration tests preserve existing branches and verify that new Staff tables are empty and row-level security is enabled. Existing JWT/JWKS, invitations, onboarding, and Branch tests are preserved.

Browser workflows cover empty/list/create/detail/edit/archive, multiple assignments, real dashboard/branch counts, retained archived assignments, history filters/reload, mobile Admin creation/archive, branch filtering, and unavailable API/retry. Tests use a local Supabase simulator and real NestJS/PostgreSQL. Live Google consent and Resend delivery are outside the Phase 4 checks.

Validated on 8 September 2026:

| Check | Result |
| --- | --- |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| Prisma validation | Pass |
| Configured database schema comparison | No difference detected |
| Staff migrations | Both applied to Supabase |
| `npm run test:auth` | 4 pass |
| `npm run test:integration` | 10 pass, no skips (includes suite container) |
| `npm run test:e2e` | 3 smoke tests pass |
| `npm run test:e2e:auth` | 9 workflows pass, including 2 Staff workflows |

The development servers were restarted after the production build. Screenshots are in `test-results/auth-browser/staff-detail-desktop.png` and `test-results/auth-browser/staff-form-mobile.png`. The temporary local test database service was stopped; application runtime uses the configured Supabase database.
