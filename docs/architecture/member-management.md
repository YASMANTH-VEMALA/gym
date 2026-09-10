# Phase 6: Member Management

Implemented on 8 September 2026. Owners and Admins can create, search, view, edit, deactivate/reactivate, and archive gym members through the existing Admin shell. Records persist through NestJS and Prisma in PostgreSQL. This phase stops at member profiles: no memberships, payments, dues, attendance, QR, or member authentication are created.

## Member domain and fields

Each Member belongs to exactly one Business and may have a registration branch. A branch QR registration always assigns that QR's active branch; an admin-created member may be unassigned. A member can be linked to a verified Supabase account through `MemberAccountLink`, which never grants admin access. Member status remains independent of Membership status.

Stored fields:

- Identity: UUID id, businessId, immutable memberNumber, fullName, normalized primary phone, optional alternatePhone and email.
- Personal: optional gender, dateOfBirth, occupation.
- Address: optional addressLine1, addressLine2, city, state, postalCode, country. Postal codes remain strings and preserve leading zeros. No country is assumed by the form.
- Emergency contacts: a structured list of up to five name, normalized phone, and optional relationship records. QR registration requires at least one.
- Profile photo: optional JPEG, PNG, or WebP image stored in a separate protected table, with a 1.5 MB decoded-size limit.
- Fitness: optional integer heightCm (1–300), integer weightGrams (1–1,000,000), and fitnessGoal (Weight Loss, Weight Gain, Muscle Gain, Strength, General Fitness, Endurance, Other).
- Other: required joiningDate, optional notes (2,000 characters), ACTIVE/INACTIVE/ARCHIVED status, createdAt, updatedAt, archivedAt.

The form takes weight in kilograms with up to three decimal places and converts decimal text exactly to integer grams. Height is a whole number of centimeters. Full name is trimmed, required, and limited to 120 characters. Email is optional, validated, trimmed, and lowercased. Fitness data does not include detailed medical history or analytics.

QR registration requires full name, mobile number, gender, date of birth, address, and at least one emergency contact. Registration branch and joining date come from the scanned branch QR and cannot be changed by the registering user. The UI computes age for display while date of birth remains the stored source value. Profile photos are submitted as validated data URLs, decoded by the API, verified by file signature, and stored as bytes; arbitrary external image URLs are rejected.

## Numbering and duplicate contacts

`MemberCounter` has one row per business, with lastNumber. Member creation locks the business row, atomically creates/increments the counter, creates the member, and writes its audit event in one transaction. Numbers are formatted as MEM000001, MEM000002, etc. Padding expands after six digits; numbers are not reused after archival. Failed transactions roll back counter changes. A database unique index on businessId/memberNumber independently enforces uniqueness. The UUID remains the primary key; incoming memberNumber, id, and businessId changes are rejected.

Phone normalization removes display spaces, parentheses, periods, and hyphens only. It preserves a leading `+`, country prefixes, and leading zeros; it does not infer countries or equate local numbers with international prefixes. The result must have 6–15 digits, with an optional leading `+`. Alternate and emergency numbers use the same normalization. Email is not unique.

ACTIVE and INACTIVE members share a unique normalized-primary-phone namespace within each business. Another business can use the same phone. A duplicate returns HTTP 409 with code DUPLICATE_MEMBER_PHONE and a message directing the operator to the existing profile. There is no silent override.

An internal nullable currentPhone column equals phone on non-archived records and becomes null on archive. The composite database unique index businessId/currentPhone prevents duplicate current profiles, while PostgreSQL's null handling permits archived history and later phone reuse. A database check enforces currentPhone/phone/status/archive consistency. The original phone stays on archived records; a new profile receives a different UUID and member number. currentPhone is excluded from API responses and cannot be supplied by clients.

## Dates and lifecycle

joiningDate and dateOfBirth use PostgreSQL DATE and YYYY-MM-DD API values. They are validated as real calendar dates on or after 1900-01-01. DOB cannot be later than today in the Business timezone. Form joining-date defaults use the Business timezone. Date-only values are never shifted through the browser timezone; UTC is used only as a serialization/display container for the same date. Creation/update timestamps display in the Business timezone. No membership expiry is calculated.

ACTIVE is the default operational status. INACTIVE is temporarily inactive, editable, and can be reactivated. ARCHIVED is read-only history. Owners and Admins can archive after the requested confirmation. Archive sets archivedAt, frees currentPhone, and hides the profile from the default active list. Repeated archive requests return the same state without duplicate archive audit events. No hard delete or restore endpoint exists. Future membership creation must reject archived members without changing their historical records.

## API endpoints and UI routes

All endpoints begin with `/api/v1/businesses/:businessId/members`:

| Method | Suffix               | Behavior                                          |
| ------ | -------------------- | ------------------------------------------------- |
| GET    | empty                | Business member list, search, status, pagination  |
| POST   | empty                | Create profile and generated member number        |
| GET    | `/:memberId`         | Profile and latest 50 real member activity events |
| PATCH  | `/:memberId`         | Edit a non-archived profile                       |
| POST   | `/:memberId/archive` | Archive while preserving history                  |

Swagger describes routes and DTO fields. List defaults: status ACTIVE, page 1, pageSize 20 (maximum 100). Status filters also accept INACTIVE, ARCHIVED, and ALL. Search matches name, member number, email, and phone; formatted phone searches are normalized. Member API queries do not accept branchId because no branch membership exists yet.

Routes:

- `/admin/members`
- `/admin/members/new`
- `/admin/members/[memberId]`
- `/admin/members/[memberId]/edit`

The list has a desktop table and mobile cards. Membership displays “No membership”; Due displays “—”. Required form fields are immediately visible, with optional personal/address/emergency/fitness sections expandable. Forms retain entered values after failed requests. The detail has Overview, Memberships, Payments, Attendance, and Activity; only Overview and real Activity are operational. Future tabs show the requested empty states. Empty lists, failed loads/retry, invalid inputs, duplicate phones, not-found/forbidden access, and archived records have explicit states.

Feature-specific TanStack Query hooks centralize all requests and use business-scoped cache keys. Mutations invalidate member lists, details, and dashboard data. Business switching leaves a member detail/create/edit route for the selected business's list.

## Authorization, audit, and dashboard

The existing Supabase JWT/JWKS AuthGuard establishes request identity. Every endpoint checks Owner/Admin BusinessAccess using the verified subject. Member reads and writes first resolve the member by both businessId and memberId; foreign IDs and forged business/member pairs cannot grant access. Strict DTO validation rejects ownership fields, member-number edits, unsupported branch/photo fields, and other unknown inputs. Member and MemberCounter have row-level security enabled with no browser policies; direct browser access remains unavailable. Existing authentication, invitation hashing, and verified-email acceptance checks are retained.

MEMBER_CREATED, MEMBER_UPDATED, and MEMBER_ARCHIVED are written transactionally. The event targetId is the member UUID; metadata contains only memberName and memberNumber. Phone, email, address, emergency contacts, fitness details, and notes are excluded. Detail activity returns only event ID, action, and timestamp; Dashboard Recent Activity shows member events by name.

Dashboard Total Members counts non-archived profiles (ACTIVE + INACTIVE). Active Members counts profiles with ACTIVE status, not memberships. Counts are business-wide even when a branch is selected. A visible note explains this: “Member counts are business-wide. Branch member totals will be available after Memberships are configured.” The Members list likewise explains business scope when a branch selector is active. Branch detail member metrics remain zero because no legitimate branch/member relationship exists yet. No fake memberships or payment values were introduced.

## Prisma migration and preservation

Migration `202609080006_member_management` adds MemberStatus, Member, and MemberCounter, their foreign keys, uniqueness constraints, range/state checks, and RLS in a transaction. Business gains reverse member and counter relations. Existing tables and rows are not rewritten.

The configured Supabase schema was inspected before migration. Local tests applied all migrations and verified existing Business, Branch, Staff, assignments, access, Invitation, AuditEvent, MembershipPlan, and PlanBranchAssignment rows remained unchanged. After those tests passed, `prisma migrate deploy` applied the migration to the configured database. Before/after content digests verified preservation of Business (2), Branch (2), Staff (1), StaffBranchAssignment (1), BusinessAccess (2), Invitation (2), AuditEvent (7), MembershipPlan (0), and PlanBranchAssignment (0). Only counts and success states were printed. Both new tables have RLS enabled. Prisma validation passes and schema comparison reports no difference.

## File inventory

Created:

```text
apps/api/prisma/migrations/202609080006_member_management/migration.sql
apps/api/src/modules/members/members.controller.ts
apps/api/src/modules/members/members.dto.ts
apps/api/src/modules/members/members.module.ts
apps/api/src/modules/members/members.service.ts
apps/web/app/admin/members/page.tsx
apps/web/app/admin/members/new/page.tsx
apps/web/app/admin/members/[memberId]/page.tsx
apps/web/app/admin/members/[memberId]/edit/page.tsx
apps/web/features/members/archive-member-dialog.tsx
apps/web/features/members/member-detail.tsx
apps/web/features/members/member-form.tsx
apps/web/features/members/member-list.tsx
apps/web/features/members/member-overview.tsx
apps/web/features/members/member-schema.ts
apps/web/features/members/member-shared.tsx
apps/web/features/members/use-members.ts
packages/types/src/members.ts
packages/validation/src/member-profile.ts
packages/validation/test/member-profile.test.cjs
e2e/auth/members.spec.ts
docs/architecture/member-management.md
```

Modified:

```text
apps/api/prisma/schema.prisma
apps/api/package.json
apps/api/src/app.module.ts
apps/api/src/modules/dashboard/dashboard.service.ts
apps/api/test/auth.integration.test.cjs
apps/api/test/browser-fixture.cjs
apps/web/components/layout/admin-navigation.ts
apps/web/features/admin/admin-context.tsx
apps/web/features/dashboard/dashboard-metrics.tsx
packages/types/src/index.ts
packages/validation/src/index.ts
package.json
package-lock.json
e2e/auth/dashboard.spec.ts
e2e/auth/membership-plans.spec.ts
README.md
docs/architecture/README.md
```

Prisma client was regenerated. API now depends on the existing internal @gym/validation workspace for shared normalization/date utilities; no external dependency was added. The dashboard navigation test now checks the connected Members heading and real empty state instead of the obsolete “coming soon” heading, and returns through the Dashboard navigation link. Its authorization, navigation, and sign-out assertions remain intact. The plan and member error-recovery tests wait for the initial list to finish loading before installing their one-request outage, ensuring the intended reload is intercepted.

## Tests and results

New API assertions cover all 18 requested scenarios, including Owner/Admin CRUD, five concurrent generated numbers, a duplicate-phone race, cross-business phone reuse, normalized search, immutable-field rejection, date and fitness validation, archived history, audit redaction, safe retries, and real business-wide dashboard counts. Local migration tests include pre-existing plan and branch-assignment records. Member-profile unit tests cover timezone boundaries, valid/invalid leap dates, prefix preservation, and exact gram conversion.

Two new Playwright workflows cover the 14 requested browser scenarios: list/empty state, registration, generated number, list/search, detail/edit, validation, archive/history, dashboard count changes, and mobile usability. They additionally check real activity, future-domain placeholders, duplicate-phone errors, data retention after create/update failures, retry, and a forged business/member URL. Existing auth, branches, staff, plans, and dashboard workflows are retained.

| Check                                 | Result                                          |
| ------------------------------------- | ----------------------------------------------- |
| `npm run lint`                        | Pass                                            |
| `npm run typecheck`                   | Pass                                            |
| `npm run build`                       | Pass                                            |
| Prisma validation                     | Pass                                            |
| Configured database schema comparison | No difference detected                          |
| Migration                             | Applied to configured Supabase database         |
| `npm run test:integration`            | 12 pass, no skips (includes suite container)    |
| `npm run test:auth`                   | 4 pass                                          |
| `npm run test:member-profile`         | 2 pass                                          |
| `npm run test:money`                  | 2 pass                                          |
| `npm run test:e2e`                    | 3 smoke tests pass                              |
| `npm run test:e2e:auth`               | 13 workflows pass, including 2 Member workflows |

Browser and API tests use isolated local PostgreSQL and a local Supabase simulator; no fake members were seeded into the configured product database. Live Google consent and Resend delivery were not reverified in Phase 6. Photo upload remains deferred.

Development servers were restarted after the production build. Readiness checks returned 200 for API health and sign-in, 307 to sign-in for an unauthenticated Members page, and 401 for an unauthenticated Member API request. The local PostgreSQL test service was stopped; runtime uses the configured Supabase database. Reviewed screenshots are saved at `test-results/auth-browser/member-detail-desktop.png` and `test-results/auth-browser/member-form-mobile.png`.
