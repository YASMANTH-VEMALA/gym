# Phase 2: Admin shell and connected dashboard

This phase adds the authenticated operations shell and dashboard only. Existing
Google/OTP authentication, onboarding, JWT/JWKS verification, and invitation
acceptance rules are preserved. No database models or migrations were added.

## Routes and navigation

- `/admin` redirects to `/admin/dashboard`, preserving business and branch filters.
- `/admin/dashboard` displays the connected dashboard.
- `/admin/settings/access` reuses the previous Admin invitation UI inside the shell.
- `/admin/settings` is a placeholder with an Owner-only link to access management.
- `/admin/branches`, `/admin/members`, `/admin/staff`, `/admin/membership-plans`,
  `/admin/memberships`, `/admin/dues`, `/admin/attendance`, `/admin/qr-management`,
  and `/admin/reports` are explicit coming-soon pages, served by an allowlisted
  dynamic route. Unknown modules return 404. No business workflows were added.

Authentication still returns through the existing `/admin` entry point. The shell
resolves current business access, sends users without access to onboarding, and
preserves pending invitation handling. The sidebar groups all navigation items;
the topbar contains branch selection, a disabled notification placeholder, and
an accessible profile menu with the existing sign-out behavior.

## Connected data and filters

`GET /api/v1/businesses/:businessId/dashboard?branchId=<uuid>` reuses the existing
JWT guard. It verifies business access and rejects a branch not belonging to that
business. Omit `branchId` for all branches. Extra query fields and malformed UUIDs
are rejected. Responses are private/no-store and share the `DashboardResponse`
contract from `@gym/types`.

Real data:

- Business name, currency, timezone, and the current user's Owner/Admin role.
- Existing branches, branch totals, and the selected branch.
- Up to eight recent, real business audit events, newest first. Actor IDs, target
  IDs, invitation tokens, and invited email addresses are not returned.
- Account name/email from the existing Supabase session/user client.

The current Branch model has no active/archive flag, so all existing branches
are selectable. No artificial active-status field was introduced. Audit records
are business-wide, so the activity panel is explicitly labeled Business-wide and
does not pretend account-level events belong to a selected branch.

Six operational metrics return zero: total members, active members, collections,
outstanding dues, today's check-ins, and expiring memberships. Collections and
member-growth series, upcoming expirations, and outstanding-dues lists are empty.
The UI renders honest empty states, not fake transactions or trends. Monetary
values are in minor units and formatted using the selected business's currency.

`businessId` and `branchId` are URL search parameters. Sidebar links preserve them;
switching businesses resets the branch. Invalid businesses never fall back to
another business silently. Invalid branch filters show a recoverable API error.
TanStack Query keys contain both IDs, so cached data cannot bleed across filters.

## Components

- `AdminProvider`, `useBusinessAccess`, and `useAccountProfile` resolve shared context.
- `AdminShell`, `AdminSidebar`, and `AdminTopbar` provide reusable navigation.
- `DashboardView`, `DashboardMetrics`, and `DashboardSections` split presentation
  from `useDashboard` and the centralized API client.
- `AccessManagement` is extracted from the previous `/admin` page; create, list,
  resend, and revoke actions remain. Mutations also invalidate dashboard activity.
- Local shadcn-style Card, Skeleton, Sheet, and DropdownMenu components use the
  existing Tailwind/cn conventions. Radix Dialog and DropdownMenu primitives handle
  focus trapping, Escape, focus restoration, and menu keyboard navigation.
- Shared `QueryError` and `ModulePlaceholder` cover recoverable failures and
  future navigation. No large UI framework or charting library was introduced.

The desktop sidebar is fixed with independently scrolling navigation. Tablet and
mobile use a modal drawer. Metric grids collapse to one column on mobile; the
existing invitation table remains horizontally scrollable within its section.

## File inventory

Created (paths relative to the repository root):

```text
apps/api/src/modules/dashboard/dashboard.controller.ts
apps/api/src/modules/dashboard/dashboard.service.ts
apps/api/src/modules/dashboard/dashboard.module.ts
apps/web/app/admin/layout.tsx
apps/web/app/admin/dashboard/page.tsx
apps/web/app/admin/[module]/page.tsx
apps/web/app/admin/settings/page.tsx
apps/web/app/admin/settings/access/page.tsx
apps/web/components/layout/admin-navigation.ts
apps/web/components/layout/admin-shell.tsx
apps/web/components/layout/admin-sidebar.tsx
apps/web/components/layout/admin-topbar.tsx
apps/web/components/shared/module-placeholder.tsx
apps/web/components/shared/query-error.tsx
apps/web/components/ui/card.tsx
apps/web/components/ui/dropdown-menu.tsx
apps/web/components/ui/sheet.tsx
apps/web/components/ui/skeleton.tsx
apps/web/features/access/access-management.tsx (moved/refactored from /admin)
apps/web/features/admin/admin-context.tsx
apps/web/features/admin/use-business-access.ts
apps/web/features/dashboard/dashboard-metrics.tsx
apps/web/features/dashboard/dashboard-sections.tsx
apps/web/features/dashboard/dashboard-view.tsx
apps/web/features/dashboard/use-dashboard.ts
e2e/auth/dashboard.spec.ts
docs/architecture/admin-dashboard.md
```

Modified:

```text
apps/api/src/app.module.ts
apps/api/src/modules/auth/auth.module.ts (export existing providers for reuse)
apps/api/package.json
apps/api/test/auth.integration.test.cjs
apps/api/test/browser-fixture.cjs
apps/web/app/admin/page.tsx (redirect)
apps/web/app/globals.css
apps/web/package.json
packages/types/src/index.ts
e2e/auth/workflow.spec.ts
e2e/frontend.smoke.spec.ts
package.json
package-lock.json
turbo.json
tsconfig.e2e.json
README.md
docs/architecture/README.md
```

## Tests and validation

The API integration suite now covers authenticated Dashboard access, rejection of
cross-business/cross-branch requests, UUID/query validation, real business/audit
data, authorized Admin access, and zero/empty future domains.

Playwright adds business switching, URL branch persistence and query updates,
currency changes, real audit rendering, empty states, error/retry/loading states,
placeholder navigation, profile sign-out, and mobile drawer keyboard/focus checks.
Existing OTP, Google PKCE, verified-email invitation, and cancellation tests are
preserved and updated for the new dashboard/access routes. Default smoke tests
also verify unauthenticated dashboard access redirects to sign-in.

Test fixtures only create records in fresh local databases whose names contain
`auth_test`. No production data is seeded for the dashboard.

Run `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e`, and
`npm run test:auth`. Use separate fresh local `TEST_DATABASE_URL` databases for
`npm run test:integration` and `npm run test:e2e:auth`. Turbo builds the shared
contract before development, typechecking, builds, and root API test commands.

Validated at completion:

| Check                      | Result                                      |
| -------------------------- | ------------------------------------------- |
| `npm run lint`             | Pass                                        |
| `npm run typecheck`        | Pass, including browser test DOM assertions |
| `npm run build`            | Pass                                        |
| `npm run format:check`     | Pass                                        |
| `npm run test:auth`        | 4 tests pass                                |
| `npm run test:integration` | 5 integration scenarios pass                |
| `npm run test:e2e`         | 3 smoke tests pass                          |
| `npm run test:e2e:auth`    | 5 authenticated browser workflows pass      |
