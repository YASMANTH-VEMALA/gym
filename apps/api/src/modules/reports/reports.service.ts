import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { calendarToday } from '@gym/validation';
import { BusinessScope, dateOnly, wire } from '../../common/business-scope';
import { Prisma } from '../../generated/prisma/client';
import { ledger } from '../finance/ledger';
import { ReportQuery } from './reports.dto';
import { reportCsv } from './csv';
type Column = { key: string; label: string; kind: 'text' | 'number' | 'money' };
const col = (
  key: string,
  label: string,
  kind: Column['kind'] = 'text',
): Column => ({ key, label, kind });
export const reportTypes = [
  'people-status',
  'collections',
  'dues',
  'memberships',
  'members',
  'branches',
  'staff',
  'attendance',
] as const;
@Injectable()
export class ReportsService {
  constructor(private readonly scope: BusinessScope) {}
  async run(
    userId: string,
    businessId: string,
    type: string,
    q: ReportQuery,
    exportCsv = false,
  ) {
    if (!(reportTypes as readonly string[]).includes(type))
      throw new NotFoundException('Report is unavailable.');
    const business = await this.scope.access(userId, businessId);
    await this.scope.branch(businessId, q.branchId);
    if (
      q.planId &&
      !(await this.scope.database.db.membershipPlan.findFirst({
        where: { id: q.planId, businessId },
      }))
    )
      throw new NotFoundException('Plan not found in this business');
    if (q.planId && !['collections', 'dues', 'memberships'].includes(type))
      throw new BadRequestException(
        'Plan filter is not applicable to this report',
      );
    if (q.method !== 'ALL' && type !== 'collections')
      throw new BadRequestException(
        'Payment method filter applies only to collections',
      );
    const today = calendarToday(business.timezone),
      from = q.from || today.slice(0, 7) + '-01',
      to = q.to || today;
    const start = dateOnly(from),
      end = dateOnly(to);
    if (start > end || (end.getTime() - start.getTime()) / 86400000 > 730)
      throw new BadRequestException(
        'Choose a date range of at most 731 calendar days in chronological order',
      );
    const allowed: Record<string, string[]> = {
      'people-status': ['ALL', 'ACTIVE', 'INACTIVE', 'ARCHIVED'],
      attendance: ['ALL'],
      collections: ['ALL'],
      dues: ['ALL', 'OPEN', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID'],
      memberships: ['ALL', 'ACTIVE', 'UPCOMING', 'EXPIRED', 'CANCELLED'],
      members: ['ALL', 'ACTIVE', 'INACTIVE', 'ARCHIVED'],
      branches: ['ALL', 'ACTIVE', 'ARCHIVED'],
      staff: ['ALL', 'ACTIVE', 'INACTIVE', 'ARCHIVED'],
    };
    if (!allowed[type]!.includes(q.status))
      throw new BadRequestException('Status is not applicable to this report');
    const branch = q.branchId
      ? Prisma.sql`AND m."branchId"=${q.branchId}::uuid`
      : Prisma.empty;
    const plan = q.planId
      ? Prisma.sql`AND m."planId"=${q.planId}::uuid`
      : Prisma.empty;
    let base: Prisma.Sql,
      metrics: Prisma.Sql,
      columns: Column[],
      dateBasis: string;
    const distributions: Array<{ name: string; sql: Prisma.Sql }> = [];
    if (type === 'people-status') {
      base = Prisma.sql`WITH report AS (
        SELECT n.id,
          n."fullName" AS member,
          n."memberNumber",
          n.phone,
          COALESCE(br.name, 'Unassigned') AS branch,
          n.status::text AS "profileStatus",
          COALESCE(latest.plan, 'No membership') AS plan,
          COALESCE(latest."membershipStatus", 'NONE') AS "membershipStatus",
          COALESCE(fin."paymentStatus", 'NO MEMBERSHIP') AS "paymentStatus",
          COALESCE(fin."outstandingMinor", 0)::bigint AS "outstandingMinor",
          COALESCE(activity."attendanceCount", 0)::int AS "attendanceCount",
          activity."lastAttendanceDate",
          COALESCE(cash."cashPaidMinor", 0)::bigint AS "cashPaidMinor"
        FROM "Member" n
        JOIN "Business" b ON b.id = n."businessId"
        LEFT JOIN "Branch" br ON br.id = n."branchId" AND br."businessId" = n."businessId"
        LEFT JOIN LATERAL (
          SELECT m.id, m."planNameSnapshot" AS plan,
            CASE
              WHEN m."cancelledAt" IS NOT NULL THEN 'CANCELLED'
              WHEN m."startDate" > ${dateOnly(today)} THEN 'UPCOMING'
              WHEN m."endDate" < ${dateOnly(today)} THEN 'EXPIRED'
              ELSE 'ACTIVE'
            END AS "membershipStatus"
          FROM "Membership" m
          WHERE m."businessId" = n."businessId" AND m."memberId" = n.id
            ${q.branchId ? Prisma.sql`AND m."branchId" = ${q.branchId}::uuid` : Prisma.empty}
          ORDER BY
            CASE
              WHEN m."cancelledAt" IS NULL AND ${dateOnly(today)} BETWEEN m."startDate" AND m."endDate" THEN 0
              WHEN m."cancelledAt" IS NULL AND m."startDate" > ${dateOnly(today)} THEN 1
              ELSE 2
            END,
            m."startDate" DESC
          LIMIT 1
        ) latest ON TRUE
        LEFT JOIN LATERAL (
          SELECT
            GREATEST(r."originalAmountMinor" - COALESCE(sum(p."amountMinor") FILTER (WHERE p.status = 'RECORDED'), 0), 0)::bigint AS "outstandingMinor",
            CASE
              WHEN r.id IS NULL THEN 'NO MEMBERSHIP'
              WHEN COALESCE(sum(p."amountMinor") FILTER (WHERE p.status = 'RECORDED'), 0) >= r."originalAmountMinor" THEN 'PAID'
              WHEN COALESCE(sum(p."amountMinor") FILTER (WHERE p.status = 'RECORDED'), 0) > 0 THEN 'PARTIALLY PAID'
              WHEN r."dueDate" < ${dateOnly(today)} THEN 'OVERDUE'
              ELSE 'DUE'
            END AS "paymentStatus"
          FROM "Receivable" r
          LEFT JOIN "Payment" p ON p."receivableId" = r.id AND p."businessId" = r."businessId"
          WHERE r."businessId" = n."businessId" AND r."membershipId" = latest.id
          GROUP BY r.id, r."originalAmountMinor", r."dueDate"
        ) fin ON TRUE
        LEFT JOIN LATERAL (
          SELECT count(*)::int AS "attendanceCount",
            to_char(max(a."attendanceDate"), 'YYYY-MM-DD') AS "lastAttendanceDate"
          FROM "Attendance" a
          WHERE a."businessId" = n."businessId" AND a."memberId" = n.id
            AND a."attendanceDate" BETWEEN ${start} AND ${end}
            ${q.branchId ? Prisma.sql`AND a."branchId" = ${q.branchId}::uuid` : Prisma.empty}
        ) activity ON TRUE
        LEFT JOIN LATERAL (
          SELECT COALESCE(sum(p."amountMinor"), 0)::bigint AS "cashPaidMinor"
          FROM "Payment" p
          JOIN "Receivable" r ON r.id = p."receivableId" AND r."businessId" = p."businessId"
          JOIN "Membership" m ON m.id = r."membershipId" AND m."businessId" = r."businessId"
          WHERE p."businessId" = n."businessId" AND m."memberId" = n.id
            AND p.status = 'RECORDED' AND p.method = 'CASH'
            AND p."paidAt" BETWEEN ${start} AND ${end}
            ${q.branchId ? Prisma.sql`AND m."branchId" = ${q.branchId}::uuid` : Prisma.empty}
        ) cash ON TRUE
        WHERE n."businessId" = ${businessId}::uuid
          ${q.branchId ? Prisma.sql`AND n."branchId" = ${q.branchId}::uuid` : Prisma.empty}
          ${q.status !== 'ALL' ? Prisma.sql`AND n.status::text = ${q.status}` : Prisma.empty}
      )`;
      columns = [
        col('member', 'Person'),
        col('memberNumber', 'Member ID'),
        col('phone', 'Phone'),
        col('branch', 'Branch'),
        col('profileStatus', 'Profile status'),
        col('plan', 'Current plan'),
        col('membershipStatus', 'Membership status'),
        col('paymentStatus', 'Payment status'),
        col('outstandingMinor', 'Outstanding (minor units)', 'money'),
        col('cashPaidMinor', 'Cash paid in period (minor units)', 'money'),
        col('attendanceCount', 'Attendance in period', 'number'),
        col('lastAttendanceDate', 'Last attendance'),
      ];
      metrics = Prisma.sql`SELECT
        count(*)::int AS "People",
        count(*) FILTER (WHERE "profileStatus" = 'ACTIVE')::int AS "Active profiles",
        count(*) FILTER (WHERE "membershipStatus" = 'ACTIVE')::int AS "Active memberships",
        count(*) FILTER (WHERE "paymentStatus" = 'PAID')::int AS "Fully paid",
        count(*) FILTER (WHERE "outstandingMinor" > 0)::int AS "People with dues",
        COALESCE(sum("outstandingMinor"), 0)::bigint AS "Outstanding",
        COALESCE(sum("cashPaidMinor"), 0)::bigint AS "Cash collected",
        COALESCE(sum("attendanceCount"), 0)::bigint AS "Attendance"
        FROM report`;
      distributions.push(
        {
          name: 'Branch distribution',
          sql: Prisma.sql`SELECT branch AS label,count(*)::int AS count FROM report GROUP BY branch ORDER BY count DESC,branch LIMIT 100`,
        },
        {
          name: 'Payment status',
          sql: Prisma.sql`SELECT "paymentStatus" AS label,count(*)::int AS count FROM report GROUP BY "paymentStatus" ORDER BY count DESC,"paymentStatus" LIMIT 100`,
        },
      );
      dateBasis =
        'One spreadsheet row per person. Profile, membership, payment balance, and branch are current; cash paid and attendance use the selected date range.';
    } else if (type === 'attendance') {
      base = Prisma.sql`WITH report AS (SELECT a.id,n."fullName" AS member,n."memberNumber",br.name AS branch,to_char(a."attendanceDate",'YYYY-MM-DD') AS date,to_char(a."checkedInAt" AT TIME ZONE 'UTC' AT TIME ZONE b.timezone,'YYYY-MM-DD HH24:MI:SS') AS "checkedInAt",to_char(a."checkedOutAt" AT TIME ZONE 'UTC' AT TIME ZONE b.timezone,'YYYY-MM-DD HH24:MI:SS') AS "checkedOutAt" FROM "Attendance" a JOIN "Member" n ON n.id=a."memberId" JOIN "Branch" br ON br.id=a."branchId" JOIN "Business" b ON b.id=a."businessId" WHERE a."businessId"=${businessId}::uuid AND a."attendanceDate" BETWEEN ${start} AND ${end} ${q.branchId ? Prisma.sql`AND a."branchId"=${q.branchId}::uuid` : Prisma.empty})`;
      columns = [
        col('member', 'Member'),
        col('memberNumber', 'Member number'),
        col('branch', 'Branch'),
        col('date', 'Attendance date'),
        col('checkedInAt', 'Checked in'),
        col('checkedOutAt', 'Checked out'),
      ];
      metrics = Prisma.sql`SELECT count(*)::int AS "Check-ins",count(*) FILTER(WHERE "checkedOutAt" IS NOT NULL)::int AS "Check-outs" FROM report`;
      dateBasis =
        'Attendance calendar date uses the branch timezone. Check-in and check-out timestamps display in the business timezone. One record per member, branch and day.';
    } else if (type === 'collections') {
      base = Prisma.sql`WITH report AS (SELECT p.id,to_char(p."paidAt",'YYYY-MM-DD') AS date,n."fullName" AS member,n."memberNumber",br.name AS branch,m."planNameSnapshot" AS plan,p.method::text AS method,p."amountMinor",p.reference FROM "Payment" p JOIN "Receivable" r ON r.id=p."receivableId" AND r."businessId"=p."businessId" JOIN "Membership" m ON m.id=r."membershipId" JOIN "Member" n ON n.id=m."memberId" JOIN "Branch" br ON br.id=m."branchId" WHERE p."businessId"=${businessId}::uuid AND p.status='RECORDED' AND p."paidAt" BETWEEN ${start} AND ${end} ${branch} ${plan} ${q.method !== 'ALL' ? Prisma.sql`AND p.method::text=${q.method}` : Prisma.empty})`;
      columns = [
        col('date', 'Payment date'),
        col('member', 'Member'),
        col('memberNumber', 'Member number'),
        col('branch', 'Branch'),
        col('plan', 'Plan'),
        col('method', 'Method'),
        col('amountMinor', 'Amount (minor units)', 'money'),
        col('reference', 'Reference'),
      ];
      metrics = Prisma.sql`SELECT count(*)::int AS "Payment count",COALESCE(sum("amountMinor"),0)::bigint AS "Total collected",COALESCE(sum("amountMinor") FILTER(WHERE method='CASH'),0)::bigint AS "Cash",COALESCE(sum("amountMinor") FILTER(WHERE method='UPI'),0)::bigint AS "UPI",COALESCE(sum("amountMinor") FILTER(WHERE method='BANK_TRANSFER'),0)::bigint AS "Bank transfer",COALESCE(sum("amountMinor") FILTER(WHERE method='CARD'),0)::bigint AS "Card",COALESCE(sum("amountMinor") FILTER(WHERE method='OTHER'),0)::bigint AS "Other" FROM report`;
      dateBasis = 'Payment date. Voided payments are excluded.';
    } else if (type === 'dues') {
      base = Prisma.sql`${ledger(businessId)}, filtered AS (SELECT * FROM ledger WHERE "dueDate" BETWEEN ${start} AND ${end} ${q.branchId ? Prisma.sql`AND "branchId"=${q.branchId}::uuid` : Prisma.empty} ${q.planId ? Prisma.sql`AND "planId"=${q.planId}::uuid` : Prisma.empty} ${q.status !== 'ALL' ? Prisma.sql`AND status=${q.status}` : Prisma.empty}), report AS (SELECT "memberId" AS id,"fullName" AS member,"memberNumber",sum("originalAmountMinor")::bigint AS "originalMinor",sum("paidMinor")::bigint AS "paidMinor",sum("outstandingMinor")::bigint AS "outstandingMinor",COALESCE(sum("outstandingMinor") FILTER(WHERE status='OVERDUE'),0)::bigint AS "overdueMinor",COALESCE(sum("outstandingMinor") FILTER(WHERE "promiseToPayDate" IS NOT NULL),0)::bigint AS "promisedMinor",count(*)::int AS memberships,to_char(min("expectedDate") FILTER(WHERE "outstandingMinor">0),'YYYY-MM-DD') AS "nextExpectedDate" FROM filtered GROUP BY "memberId","fullName","memberNumber")`;
      columns = [
        col('member', 'Member'),
        col('memberNumber', 'Member number'),
        col('memberships', 'Memberships', 'number'),
        col('originalMinor', 'Original (minor units)', 'money'),
        col('paidMinor', 'Paid (minor units)', 'money'),
        col('outstandingMinor', 'Outstanding (minor units)', 'money'),
        col('overdueMinor', 'Overdue (minor units)', 'money'),
        col('promisedMinor', 'Promised (minor units)', 'money'),
        col('nextExpectedDate', 'Next expected date'),
      ];
      metrics = Prisma.sql`SELECT COALESCE(sum("outstandingMinor"),0)::bigint AS "Outstanding",COALESCE(sum("outstandingMinor") FILTER(WHERE status='OVERDUE'),0)::bigint AS "Overdue",COALESCE(sum("outstandingMinor") FILTER(WHERE "promiseToPayDate" IS NOT NULL),0)::bigint AS "Promised",COALESCE(sum("paidMinor"),0)::bigint AS "Paid amount",count(*) FILTER(WHERE status='PAID')::int AS "Paid memberships",count(*) FILTER(WHERE "paidMinor">0 AND "outstandingMinor">0)::int AS "Partially paid memberships" FROM filtered`;
      dateBasis =
        'Original membership due date. Balances and overdue status are current, grouped by member. Promise dates remain effective until changed or cleared.';
    } else if (type === 'memberships') {
      base = Prisma.sql`WITH source AS (SELECT m.id,n."fullName" AS member,n."memberNumber",br.name AS branch,m."planNameSnapshot" AS plan,m."priceMinorSnapshot" AS "amountMinor",to_char(m."startDate",'YYYY-MM-DD') AS "startDate",to_char(m."endDate",'YYYY-MM-DD') AS "endDate",CASE WHEN m."cancelledAt" IS NOT NULL THEN 'CANCELLED' WHEN m."startDate">${dateOnly(today)} THEN 'UPCOMING' WHEN m."endDate"<${dateOnly(today)} THEN 'EXPIRED' ELSE 'ACTIVE' END AS status FROM "Membership" m JOIN "Member" n ON n.id=m."memberId" JOIN "Branch" br ON br.id=m."branchId" WHERE m."businessId"=${businessId}::uuid AND m."startDate" BETWEEN ${start} AND ${end} ${branch} ${plan}), report AS (SELECT * FROM source ${q.status !== 'ALL' ? Prisma.sql`WHERE status=${q.status}` : Prisma.empty})`;
      columns = [
        col('member', 'Member'),
        col('memberNumber', 'Member number'),
        col('branch', 'Branch'),
        col('plan', 'Agreed plan'),
        col('startDate', 'Start'),
        col('endDate', 'End'),
        col('amountMinor', 'Agreed fee (minor units)', 'money'),
        col('status', 'Current status'),
      ];
      metrics = Prisma.sql`SELECT count(*)::int AS "Total memberships",count(*) FILTER(WHERE status='ACTIVE')::int AS "Active",count(*) FILTER(WHERE status='UPCOMING')::int AS "Upcoming",count(*) FILTER(WHERE status='EXPIRED')::int AS "Expired",count(*) FILTER(WHERE status='CANCELLED')::int AS "Cancelled" FROM report`;
      distributions.push(
        {
          name: 'Plan distribution',
          sql: Prisma.sql`SELECT plan AS label,count(*)::int AS count FROM report GROUP BY plan ORDER BY count DESC,plan LIMIT 100`,
        },
        {
          name: 'Branch distribution',
          sql: Prisma.sql`SELECT branch AS label,count(*)::int AS count FROM report GROUP BY branch ORDER BY count DESC,branch LIMIT 100`,
        },
      );
      dateBasis =
        'Membership start date. Status is computed today in the business timezone. Plan names and prices are agreed snapshots.';
    } else if (type === 'members') {
      base = Prisma.sql`WITH report AS (SELECT n.id,n."fullName" AS member,n."memberNumber",n.phone,n.email,to_char(n."joiningDate",'YYYY-MM-DD') AS "joiningDate",n.status::text AS status FROM "Member" n WHERE n."businessId"=${businessId}::uuid AND n."joiningDate" BETWEEN ${start} AND ${end} ${q.status !== 'ALL' ? Prisma.sql`AND n.status::text=${q.status}` : Prisma.empty} ${q.branchId ? Prisma.sql`AND n."branchId"=${q.branchId}::uuid` : Prisma.empty})`;
      columns = [
        col('member', 'Member'),
        col('memberNumber', 'Member number'),
        col('phone', 'Phone'),
        col('email', 'Email'),
        col('joiningDate', 'Joined'),
        col('status', 'Profile status'),
      ];
      metrics = Prisma.sql`SELECT count(*)::int AS "Total profiles",count(*) FILTER(WHERE status='ACTIVE')::int AS "Active",count(*) FILTER(WHERE status='INACTIVE')::int AS "Inactive",count(*) FILTER(WHERE status='ARCHIVED')::int AS "Archived" FROM report`;
      distributions.push({
        name: 'Joining trends',
        sql: Prisma.sql`SELECT left("joiningDate",7) AS label,count(*)::int AS count FROM report GROUP BY left("joiningDate",7) ORDER BY label`,
      });
      dateBasis =
        'Profile joining date. A branch filter includes profiles registered at that branch. Profiles belong to the business.';
    } else if (type === 'branches') {
      base = Prisma.sql`${ledger(businessId)}, report AS (SELECT br.id,br.name AS branch,br.code,br.status::text AS status,(SELECT count(*)::int FROM ledger l WHERE l."branchId"=br.id AND l."cancelledAt" IS NULL AND today BETWEEN l."startDate" AND l."endDate") AS "activeMemberships",(SELECT count(DISTINCT l."memberId")::int FROM ledger l WHERE l."branchId"=br.id AND l."cancelledAt" IS NULL AND today BETWEEN l."startDate" AND l."endDate") AS "activeMembers",(SELECT COALESCE(sum(p."amountMinor"),0)::bigint FROM "Payment" p JOIN "Receivable" r ON r.id=p."receivableId" JOIN "Membership" m ON m.id=r."membershipId" WHERE p."businessId"=${businessId}::uuid AND m."branchId"=br.id AND p.status='RECORDED' AND p."paidAt" BETWEEN ${start} AND ${end}) AS "collectionsMinor",(SELECT COALESCE(sum(l."outstandingMinor"),0)::bigint FROM ledger l WHERE l."branchId"=br.id) AS "outstandingMinor",(SELECT count(*)::int FROM "StaffBranchAssignment" a JOIN "Staff" s ON s.id=a."staffId" WHERE a."branchId"=br.id AND s.status='ACTIVE') AS "staffCount" FROM "Branch" br WHERE br."businessId"=${businessId}::uuid ${q.branchId ? Prisma.sql`AND br.id=${q.branchId}::uuid` : Prisma.empty} ${q.status !== 'ALL' ? Prisma.sql`AND br.status::text=${q.status}` : Prisma.empty})`;
      columns = [
        col('branch', 'Branch'),
        col('code', 'Code'),
        col('status', 'Status'),
        col('activeMemberships', 'Active memberships', 'number'),
        col('activeMembers', 'Unique active members', 'number'),
        col('collectionsMinor', 'Collections (minor units)', 'money'),
        col('outstandingMinor', 'Outstanding (minor units)', 'money'),
        col('staffCount', 'Active staff', 'number'),
      ];
      metrics = Prisma.sql`SELECT count(*)::int AS "Branches",COALESCE(sum("activeMemberships"),0)::bigint AS "Active memberships",COALESCE(sum("collectionsMinor"),0)::bigint AS "Collections",COALESCE(sum("outstandingMinor"),0)::bigint AS "Outstanding" FROM report`;
      dateBasis =
        'Payment date for collections only. Memberships, unique members, staff and outstanding dues are current. A person active at multiple branches is counted once per branch.';
    } else {
      base = Prisma.sql`WITH report AS (SELECT s.id,s."fullName" AS staff,s."jobTitle",s.status::text AS status,to_char(s."joiningDate",'YYYY-MM-DD') AS "joiningDate",(SELECT string_agg(br.name,', ' ORDER BY br.name) FROM "StaffBranchAssignment" a JOIN "Branch" br ON br.id=a."branchId" WHERE a."staffId"=s.id) AS branches,(SELECT count(*)::int FROM "StaffBranchAssignment" a WHERE a."staffId"=s.id) AS assignments FROM "Staff" s WHERE s."businessId"=${businessId}::uuid AND s."joiningDate" BETWEEN ${start} AND ${end} ${q.status !== 'ALL' ? Prisma.sql`AND s.status::text=${q.status}` : Prisma.empty} ${q.branchId ? Prisma.sql`AND EXISTS(SELECT 1 FROM "StaffBranchAssignment" a WHERE a."staffId"=s.id AND a."branchId"=${q.branchId}::uuid)` : Prisma.empty})`;
      columns = [
        col('staff', 'Staff'),
        col('jobTitle', 'Job title'),
        col('status', 'Status'),
        col('joiningDate', 'Joined'),
        col('branches', 'Branch assignments'),
        col('assignments', 'Assignment count', 'number'),
      ];
      metrics = Prisma.sql`SELECT count(*)::int AS "Total staff",count(*) FILTER(WHERE status='ACTIVE')::int AS "Active",count(*) FILTER(WHERE status='INACTIVE')::int AS "Inactive",count(*) FILTER(WHERE status='ARCHIVED')::int AS "Archived",COALESCE(sum(assignments),0)::bigint AS "Branch assignments" FROM report`;
      distributions.push({
        name: 'Job-title distribution',
        sql: Prisma.sql`SELECT "jobTitle" AS label,count(*)::int AS count FROM report GROUP BY "jobTitle" ORDER BY count DESC,"jobTitle" LIMIT 100`,
      });
      dateBasis =
        'Staff joining date. Branch assignments include historical archived branch assignments. No payroll data.';
    }
    const result = await this.scope.database.db.$transaction(
      async (tx) => {
        const counts = await tx.$queryRaw<Array<{ total: number }>>(
          Prisma.sql`${base} SELECT count(*)::int AS total FROM report`,
        );
        const total = counts[0]!.total;
        if (exportCsv && total > 10000)
          throw new BadRequestException(
            'Export is limited to 10,000 rows. Narrow the date range or filters.',
          );
        const rows = await tx.$queryRaw<Array<Record<string, unknown>>>(
          Prisma.sql`${base} SELECT * FROM report ORDER BY ${type === 'people-status' ? Prisma.sql`member, id` : Prisma.sql`id`} LIMIT ${exportCsv ? 10000 : q.pageSize} OFFSET ${exportCsv ? 0 : (q.page - 1) * q.pageSize}`,
        );
        const summary = await tx.$queryRaw<Array<Record<string, number>>>(
          Prisma.sql`${base} ${metrics}`,
        );
        const groups: Record<
          string,
          Array<{ label: string; count: number }>
        > = {};
        for (const d of distributions)
          groups[d.name] = await tx.$queryRaw(Prisma.sql`${base} ${d.sql}`);
        return wire({
          columns,
          rows,
          total,
          metrics: summary[0],
          distributions: groups,
          page: q.page,
          pageSize: q.pageSize,
          currency: business.currency,
          timezone: business.timezone,
          from,
          to,
          dateBasis,
        });
      },
      { isolationLevel: 'RepeatableRead', timeout: 15000 },
    );
    return exportCsv
      ? {
          filename: `gym-${type}-${from}-${to}.csv`,
          csv: reportCsv(columns, result.rows),
        }
      : result;
  }
}
