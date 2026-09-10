# Admin product audit and implementation — 9 September 2026

The reported branch switch bug was caused by unfinished business-wide member queries, not a stale browser alone. `Member` had no registration branch; the UI omitted branch filters and deliberately displayed a warning. Memberships, finance and QR features had subsequently been added without updating all earlier screens.

## Delivered behavior

- Member registration has an explicit branch, defaults to the selected branch, and can be transferred through Edit Member. Unassigned is an explicit option. The API checks business ownership and active branch eligibility. A composite foreign key prevents foreign-business assignments at database level.
- Member lists, dashboard totals, growth charts, member reports and member QR lists use the registration branch. Counts, pagination and cache keys respond to branch changes. Switching business or branch resets stale forms and paging; old content is hidden during the transition.
- A registration branch is distinct from a purchased membership's branch. A member can buy a plan at another branch. Financial totals and check-in eligibility follow the purchased membership. Transferring registration does not rewrite memberships, payments or attendance history.
- Branch details and lists show real member counts. Branch details show active memberships, collections, outstanding balances and check-ins. Monetary values now correctly convert integer minor units rather than displaying paise as rupees. Branch tabs link to the corresponding operational screens.
- Plans show actual distinct active/total member counts and valid payment revenue. The Members tab displays the plan's membership history. The assignment form filters available plans by branch and resets its idempotency key when the operator changes the request, while exact retries retain their key.
- Attendance supports authorized check-in and check-out, branch/date/member filtering, member history and CSV reports. Active member, branch and membership eligibility are checked transactionally. Concurrent retries produce one attendance record per member, branch and branch-local calendar day. Check-out is idempotent. Business-wide today's totals respect each branch's timezone.
- Members can view their attendance through their linked account. QR registration persists the QR's branch. Scanning a member QR identifies the member to authorized staff and links to their profile; staff explicitly record check-in.
- Settings opens working access management. Owners can list the current team and revoke an Admin's access with confirmation. Admins cannot remove the Owner or change team access. Revocation is audited and subsequent requests lose access immediately. No real invitations or other messages were sent during this work.
- Staff profiles expose real branch assignments and audit history. Unimplemented trainer-assignment and staff-attendance tabs were replaced with the supported employment-record workflows.
- The notification bell displays current membership-renewal and outstanding-payment reminders. These are computed reminders, not a delivery/read-receipt notification system.
- Member account switching clears stale cached account data. QR fragment credentials synchronize through an external store and stay out of query keys and URLs after initial capture.

## Existing data and deployment

Applied additive migrations `202609090011_member_branch` and `202609090012_attendance` to the configured database. The preservation script compares the original columns before and after migration, allowing additive columns without overlooking changes to existing data. All 17 pre-existing application tables passed the content/count preservation check, including both member profiles and account links.

Old profiles have no reliable registration-branch field. They remain **Unassigned**, visible under **All Branches**; assigning a branch is available in Edit Member. No old memberships or arbitrary branch assignments were fabricated. The user was asked whether both members in the screenshots should be assigned to K5; that data decision remains pending.

The new Attendance table has row-level security enabled. API access is through the existing authenticated service. The application on localhost responds successfully, and the running API exposes the attendance routes.

## Verification

- Production build: passed for all seven workspaces.
- Type checking: passed, including browser test types.
- Lint: passed.
- Prisma schema validation: passed. Deployed schema comparison: no difference detected.
- Localhost smoke tests: all three passed (API health, sign-in page and unauthenticated dashboard redirect).
- PostgreSQL integration suite: 20 tests passed, no skipped tests. Coverage includes cross-business access, registration transfers, foreign branch rejection, attendance eligibility and concurrent retries, checkout, member-only history, QR registration branch persistence, and Owner-only Admin revocation.
- Authenticated Playwright suite: 16 workflows passed. The new regression covers branch registration, switching, transfer, membership assignment, check-in/check-out, attendance reporting, exact branch money display, Settings and mobile member cards.
- Tests use a separate PostgreSQL instance bound to 127.0.0.1 and fresh local databases; the test instance was stopped afterward. No test gym/member/payment data was written to the configured product database.
- Reviewed mobile screenshot: `test-results/admin-branch-mobile.png`.

## Remaining product boundaries

This completes the audited admin operational flows; it is not a claim that every possible gym product feature is implemented. Member photo uploads, online payment processing/refunds/invoices, trainer-to-member assignments, payroll/staff attendance, and member self-check-in are not implemented. Attendance currently allows one visit record per member/branch/day. Settings exposes access management and existing business information, not currency or timezone editing. Live Google consent, real email delivery, public HTTPS deployment, backups and production load behavior were not reverified.

## Research references

Implementation decisions were checked against the installed Next.js router documentation and the primary framework documentation:

- [TanStack Query: query keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys): include scope/filter inputs in cache keys so changes use the appropriate data.
- [Prisma 7: transactions](https://docs.prisma.io/docs/orm/v7/prisma-client/queries/transactions): transaction boundaries and isolation for related reads/writes. Existing business-row locking was retained for serialized operational mutations.

Earlier phase documents describe historical scope and may still mention deferred modules. This report supersedes those statements for the flows listed above.
