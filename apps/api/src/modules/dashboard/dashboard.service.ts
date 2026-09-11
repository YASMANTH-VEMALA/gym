import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { ledger } from '../finance/ledger';
import { wire, dateOnly } from '../../common/business-scope';
import { calendarToday } from '@gym/validation';
import type { DashboardResponse, AccessSectionSlug } from '@gym/types';
import { todayCheckIns } from '../../common/attendance-metrics';
import { DatabaseService } from '../../database/database.service';

const activityLabels: Record<string, string> = {
  MEMBER_CHECKED_IN: 'Member checked in',
  MEMBER_CHECKED_OUT: 'Member checked out',
  ADMIN_ACCESS_REVOKED: 'Admin access revoked',
  MEMBERSHIP_CREATED: 'Membership assigned',
  MEMBERSHIP_CANCELLED: 'Membership cancelled',
  PAYMENT_RECORDED: 'Cash payment recorded',
  PAYMENT_VOIDED: 'Payment voided',
  PROMISE_TO_PAY_SET: 'Promise to pay set',
  PROMISE_TO_PAY_UPDATED: 'Promise to pay updated',
  MEMBER_CREATED: 'Member registered',
  MEMBER_UPDATED: 'Member updated',
  MEMBER_ARCHIVED: 'Member archived',
  OWNER_ONBOARDED: 'Business and first branch created',
  ADMIN_INVITED: 'Team invitation created',
  INVITATION_RESENT: 'Team invitation renewed',
  INVITATION_REVOKED: 'Team invitation revoked',
  INVITATION_ACCEPTED: 'Team member joined',
  TEAM_ACCESS_UPDATED: 'Team permissions updated',
  BRANCH_CREATED: 'Branch created',
  BRANCH_UPDATED: 'Branch updated',
  BRANCH_ARCHIVED: 'Branch archived',
  STAFF_CREATED: 'Staff created',
  STAFF_UPDATED: 'Staff updated',
  STAFF_ARCHIVED: 'Staff archived',
  MEMBERSHIP_PLAN_CREATED: 'Membership plan created',
  MEMBERSHIP_PLAN_UPDATED: 'Membership plan updated',
  MEMBERSHIP_PLAN_ARCHIVED: 'Membership plan archived',
  ATTENDANCE_CELL_PRESENT: 'Attendance marked Present',
  ATTENDANCE_CELL_ABSENT: 'Attendance marked Absent',
  ATTENDANCE_CELL_REST: 'Attendance marked Rest',
};

@Injectable()
export class DashboardService {
  constructor(private readonly database: DatabaseService) {}

  async get(
    userId: string,
    businessId: string,
    branchId?: string,
  ): Promise<DashboardResponse> {
    const access = await this.database.db.businessAccess.findUnique({
      where: { businessId_userId: { businessId, userId } },
      select: {
        role: true,
        assignedBranchId: true,
        permissions: true,
        business: {
          select: {
            id: true,
            name: true,
            currency: true,
            timezone: true,
            logoUrl: true,
            branches: {
              where: { status: 'ACTIVE' },
              select: { id: true, name: true, timezone: true },
            },
          },
        },
      },
    });
    if (!access)
      throw new ForbiddenException('You do not have access to this business');

    // Enforce branch scoping for managers
    let effectiveBranchId = branchId;
    if (access.assignedBranchId) {
      if (branchId && branchId !== access.assignedBranchId) {
        throw new ForbiddenException(
          'You only have access to your assigned branch',
        );
      }
      effectiveBranchId = access.assignedBranchId;
    }

    const branches = access.assignedBranchId
      ? access.business.branches.filter((b) => b.id === access.assignedBranchId)
      : access.business.branches;

    const selected = effectiveBranchId
      ? branches.find((branch) => branch.id === effectiveBranchId)
      : null;
    if (effectiveBranchId && !selected)
      throw new ForbiddenException(
        'This branch is not available in the selected business',
      );
    branchId = effectiveBranchId;

    const business = {
      id: access.business.id,
      name: access.business.name,
      currency: access.business.currency,
      timezone: access.business.timezone,
      logoUrl: access.business.logoUrl,
    };

    const branchFilter = branchId
      ? Prisma.sql`AND "branchId"=${branchId}::uuid`
      : Prisma.empty;

    const todayDateStr = calendarToday(selected?.timezone || business.timezone);
    const monthStartStr = `${todayDateStr.slice(0, 7)}-01`;

    const events = await this.database.db.auditEvent.findMany({
      where: { businessId, action: { in: Object.keys(activityLabels) } },
      select: { id: true, action: true, createdAt: true, metadata: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 8,
    });

    const totalStaff = await this.database.db.staff.count({
      where: {
        businessId,
        status: 'ACTIVE',
        ...(branchId ? { branchAssignments: { some: { branchId } } } : {}),
      },
    });

    const [totalMembers, activeMembers] = await this.database.db.$transaction(
      [
        this.database.db.member.count({
          where: {
            businessId,
            ...(branchId ? { branchId } : {}),
            status: { not: 'ARCHIVED' },
          },
        }),
        this.database.db.member.count({
          where: {
            businessId,
            ...(branchId ? { branchId } : {}),
            status: 'ACTIVE',
          },
        }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );

    const [finance] = await this.database.db.$queryRaw<
      Array<{ collections: bigint; outstanding: bigint }>
    >(
      Prisma.sql`${ledger(businessId)} SELECT (SELECT COALESCE(sum(p."amountMinor"),0)::bigint FROM "Payment" p JOIN "Receivable" r ON r.id=p."receivableId" JOIN "Membership" m ON m.id=r."membershipId" JOIN "Business" b ON b.id=p."businessId" WHERE p."businessId"=${businessId}::uuid AND p.status='RECORDED' AND p."paidAt">=date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE b.timezone)::date AND p."paidAt"<=(CURRENT_TIMESTAMP AT TIME ZONE b.timezone)::date ${branchId ? Prisma.sql`AND m."branchId"=${branchId}::uuid` : Prisma.empty}) AS collections, COALESCE(sum("outstandingMinor"),0)::bigint AS outstanding FROM ledger ${branchId ? Prisma.sql`WHERE "branchId"=${branchId}::uuid` : Prisma.empty}`,
    );

    const [todayCashRow] = await this.database.db.$queryRaw<
      Array<{ todayCash: bigint }>
    >(
      Prisma.sql`SELECT COALESCE(sum(p."amountMinor"),0)::bigint AS "todayCash" FROM "Payment" p JOIN "Receivable" r ON r.id=p."receivableId" JOIN "Membership" m ON m.id=r."membershipId" JOIN "Business" b ON b.id=p."businessId" WHERE p."businessId"=${businessId}::uuid AND p.status='RECORDED' AND p."paidAt"=(CURRENT_TIMESTAMP AT TIME ZONE b.timezone)::date ${branchId ? Prisma.sql`AND m."branchId"=${branchId}::uuid` : Prisma.empty}`,
    );

    const activeOnFloorNow = await this.database.db.attendance.count({
      where: {
        businessId,
        ...(branchId ? { branchId } : {}),
        attendanceDate: dateOnly(todayDateStr),
        checkedOutAt: null,
      },
    });

    const newRegistrationsThisMonth = await this.database.db.member.count({
      where: {
        businessId,
        ...(branchId ? { branchId } : {}),
        joiningDate: {
          gte: dateOnly(monthStartStr),
        },
      },
    });

    const [duesCountRow] = await this.database.db.$queryRaw<
      Array<{ count: number }>
    >(
      Prisma.sql`${ledger(businessId)} SELECT count(DISTINCT "memberId")::int AS count FROM ledger WHERE "outstandingMinor" > 0 ${branchFilter}`,
    );

    const [expirations, outstanding, collections, growth, expirationCount] =
      await Promise.all([
        this.database.db.$queryRaw<DashboardResponse['upcomingExpirations']>(
          Prisma.sql`${ledger(businessId)} SELECT l."membershipId" AS id, l."fullName" AS "memberName", l."planNameSnapshot" AS "planName", to_char(l."endDate",'YYYY-MM-DD') AS "endDate", m.phone FROM ledger l JOIN "Member" m ON m.id = l."memberId" WHERE l."cancelledAt" IS NULL AND l."endDate" BETWEEN today AND today+7 ${branchFilter} ORDER BY l."endDate", l."membershipId" LIMIT 5`,
        ),
        this.database.db.$queryRaw<DashboardResponse['outstandingDues']>(
          Prisma.sql`${ledger(businessId)} SELECT l."membershipId" AS id, l."fullName" AS "memberName", l."planNameSnapshot" AS "planName", l."outstandingMinor" AS "amountMinor", to_char(l."expectedDate",'YYYY-MM-DD') AS "dueDate", m.phone FROM ledger l JOIN "Member" m ON m.id = l."memberId" WHERE l."outstandingMinor">0 ${branchFilter} ORDER BY l."expectedDate", l."membershipId" LIMIT 5`,
        ),
        this.database.db.$queryRaw<
          DashboardResponse['chartData']['collections']
        >(
          Prisma.sql`SELECT to_char(p."paidAt",'YYYY-MM-DD') AS date, sum(p."amountMinor")::bigint AS "amountMinor" FROM "Payment" p JOIN "Receivable" r ON r.id=p."receivableId" JOIN "Membership" m ON m.id=r."membershipId" JOIN "Business" b ON b.id=p."businessId" WHERE p."businessId"=${businessId}::uuid AND p.status='RECORDED' AND p."paidAt">=date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE b.timezone)::date AND p."paidAt"<=(CURRENT_TIMESTAMP AT TIME ZONE b.timezone)::date ${branchId ? Prisma.sql`AND m."branchId"=${branchId}::uuid` : Prisma.empty} GROUP BY p."paidAt" ORDER BY p."paidAt"`,
        ),
        this.database.db.$queryRaw<
          DashboardResponse['chartData']['memberGrowth']
        >(
          Prisma.sql`SELECT to_char(date_trunc('month',n."joiningDate"),'YYYY-MM') AS date, count(*)::int AS count FROM "Member" n JOIN "Business" b ON b.id=n."businessId" WHERE n."businessId"=${businessId}::uuid AND n."joiningDate">=date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE b.timezone)-interval '5 months' AND n."joiningDate"<=(CURRENT_TIMESTAMP AT TIME ZONE b.timezone)::date ${branchId ? Prisma.sql`AND n."branchId"=${branchId}::uuid` : Prisma.empty} GROUP BY date_trunc('month',n."joiningDate") ORDER BY date_trunc('month',n."joiningDate")`,
        ),
        this.database.db.$queryRaw<Array<{ count: number }>>(
          Prisma.sql`${ledger(businessId)} SELECT count(*)::int AS count FROM ledger WHERE "cancelledAt" IS NULL AND "endDate" BETWEEN today AND today+7 ${branchFilter}`,
        ),
      ]);

    return {
      business,
      role: access.role,
      assignedBranchId: access.assignedBranchId,
      permissions: (access.permissions as AccessSectionSlug[]) || undefined,
      branchSummary: {
        total: branches.length,
        inScope: selected ? 1 : branches.length,
        selected: selected ?? null,
      },
      metrics: {
        totalMembers,
        activeMembers,
        collections: Number(finance?.collections || 0),
        outstandingDues: Number(finance?.outstanding || 0),
        todayCheckIns: await todayCheckIns(
          this.database.db,
          businessId,
          branchId,
        ),
        expiringSoon: expirationCount[0]?.count || 0,
        totalStaff,
        todayCashCollected: Number(todayCashRow?.todayCash || 0),
        monthCashCollected: Number(finance?.collections || 0),
        activeOnFloorNow,
        membersWithDuesCount: duesCountRow?.count || 0,
        newRegistrationsThisMonth,
      },
      recentActivity: events.map((event) => ({
        id: event.id,
        label:
          activityLabels[event.action] ||
          event.action.replace(/_/g, ' ').toLowerCase(),
        occurredAt: event.createdAt.toISOString(),
      })),
      activityScope: branchId ? 'branch' : 'business',
      upcomingExpirations: expirations,
      outstandingDues: wire(outstanding),
      chartData: { collections: wire(collections), memberGrowth: growth },
      generatedAt: new Date().toISOString(),
    };
  }
}
