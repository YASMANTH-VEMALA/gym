# Operational reports

Phase 11 adds no tables or migrations. Reports read existing persisted profiles, staff assignments, memberships, receivables and payments through NestJS. SQL aggregates execute in a repeatable-read transaction. Rows paginate up to 100; CSV exports cap at 10,000 and require narrower filters beyond the cap. Distribution panels cap at 100 groups and say so. Maximum date span is 731 inclusive calendar days.

`GET /api/v1/businesses/:businessId/reports/:type` and `GET .../:type/export` support people-status, collections, dues, memberships, members, branches, staff, and attendance. Export uses identical authorization, filters and calculations to the screen. Invalid or inapplicable filters fail rather than being silently ignored. Owner/Admin access and every supplied branch/plan are verified in the selected business.

Default dates are the first day of the current business month through today, in the configured business timezone. Payment, due, membership and joining dates are date-only values; they never shift through UTC conversion. Each report states its date basis:

- Collections: non-void payments within the inclusive payment-date range; totals by method and payment count.
- People & Status: one Excel-style row per member with branch, profile status, current membership/plan, payment status, outstanding amount, cash paid during the range, attendance count, and last attendance date.
- Dues: original due date within the range; current balances grouped by member, with overdue, promised, paid and partial totals. Promise dates do not rewrite original due dates.
- Memberships: membership start date within the range; status as of today, plan snapshot and branch distributions.
- Members: profile joining date; current profile statuses and monthly joining trends. A branch filter means any membership history at that branch, while the profile remains business-owned.
- Branches: payment-date range applies to collections; active membership/member counts, staff assignments and dues are current. People at several branches count once per branch, so branch member counts are not a unique business total.
- Staff: staff joining date; status, historical branch assignments and job-title distribution. No payroll.

CSV uses UTF-8 with BOM, CRLF records, quoted cells and doubled embedded quotes. User-controlled string values beginning with `=`, `+`, `-` or `@`, including after leading whitespace/control characters, receive a literal apostrophe prefix to prevent spreadsheet formulas. Exported monetary columns are explicitly labelled minor units and contain exact integers. The UI formats those same integers in the business currency. CSV content includes only report columns, not hidden database identifiers or secrets.

`/admin/reports` provides filters, metrics, tables, distributions, empty/error/retry states, CSV download and mobile horizontal table scrolling. Attendance is clearly unavailable because that domain does not exist. Tests cover actual amounts and void exclusion, membership/staff/member counts, date boundaries, tenant and foreign-filter rejection, bounds validation, CSV quoting/formula protection, connected browser reports and export.
