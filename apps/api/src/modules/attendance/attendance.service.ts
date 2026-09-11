import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { calendarToday } from '@gym/validation';
import { BusinessScope, dateOnly, wire } from '../../common/business-scope';
import {
  AttendanceQuery,
  CheckInDto,
  GoogleSheetsSyncDto,
  MarkAllTodayDto,
  MonthlyMatrixQuery,
  UpdateMatrixCellDto,
} from './attendance.dto';
import type { MonthlyMatrixDay } from '@gym/types';

@Injectable()
export class AttendanceService {
  constructor(private readonly scope: BusinessScope) {}

  async list(userId: string, businessId: string, q: AttendanceQuery) {
    const { effectiveBranchId } = await this.scope.checkAccess(
      userId,
      businessId,
      'attendance',
      q.branchId,
    );
    return this.history(businessId, { ...q, branchId: effectiveBranchId });
  }

  async history(businessId: string, q: AttendanceQuery) {
    const where = {
      businessId,
      ...(q.branchId ? { branchId: q.branchId } : {}),
      ...(q.memberId ? { memberId: q.memberId } : {}),
      ...(q.date ? { attendanceDate: dateOnly(q.date) } : {}),
    };
    const [total, items] = await this.scope.database.db.$transaction(
      [
        this.scope.database.db.attendance.count({ where }),
        this.scope.database.db.attendance.findMany({
          where,
          include: {
            member: { select: { fullName: true, memberNumber: true } },
            branch: { select: { name: true } },
          },
          orderBy: [{ checkedInAt: 'desc' }, { id: 'asc' }],
          take: q.pageSize,
          skip: (q.page - 1) * q.pageSize,
        }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return wire({ total, items, page: q.page, pageSize: q.pageSize });
  }

  async checkIn(userId: string, businessId: string, input: CheckInDto) {
    await this.scope.checkAccess(
      userId,
      businessId,
      'attendance',
      input.branchId,
    );
    return this.scope.write(userId, businessId, async (tx) => {
      const branch = await tx.branch.findFirst({
        where: { id: input.branchId, businessId, status: 'ACTIVE' },
        include: { business: true },
      });
      const member = await tx.member.findFirst({
        where: { id: input.memberId, businessId, status: 'ACTIVE' },
      });
      if (!branch || !member)
        throw new NotFoundException(
          'Select an active member and branch in this business.',
        );
      const day = dateOnly(
        calendarToday(branch.timezone || branch.business.timezone),
      );
      const existing = await tx.attendance.findUnique({
        where: {
          businessId_branchId_memberId_attendanceDate: {
            businessId,
            ...input,
            attendanceDate: day,
          },
        },
      });
      if (existing) return wire(existing);
      const membership = await tx.membership.findFirst({
        where: {
          businessId,
          ...input,
          cancelledAt: null,
          startDate: { lte: day },
          endDate: { gte: day },
        },
        orderBy: { endDate: 'asc' },
      });
      if (!membership)
        throw new ConflictException(
          'An active membership at this branch is required to check in.',
        );
      const attendance = await tx.attendance.create({
        data: {
          businessId,
          ...input,
          membershipId: membership.id,
          attendanceDate: day,
          status: 'PRESENT',
          recordedByUserId: userId,
        },
      });
      await this.scope.audit(
        tx,
        businessId,
        userId,
        attendance.id,
        'MEMBER_CHECKED_IN',
      );
      return wire(attendance);
    });
  }

  async checkOut(userId: string, businessId: string, id: string) {
    return this.scope.write(userId, businessId, async (tx) => {
      const current = await tx.attendance.findFirst({
        where: { id, businessId },
      });
      if (!current) throw new NotFoundException('Attendance record not found');
      if (current.checkedOutAt) return wire(current);
      const result = await tx.attendance.update({
        where: { id },
        data: { checkedOutAt: new Date() },
      });
      await this.scope.audit(tx, businessId, userId, id, 'MEMBER_CHECKED_OUT');
      return wire(result);
    });
  }

  async memberHistory(userId: string, memberId: string, q: AttendanceQuery) {
    const link = await this.scope.database.db.memberAccountLink.findFirst({
      where: { userId, memberId },
    });
    if (!link)
      throw new NotFoundException('Member profile not linked to this account');
    const result = await this.history(link.businessId, { ...q, memberId });
    return {
      ...result,
      items: result.items.map(
        ({ id, attendanceDate, checkedInAt, checkedOutAt, branch }) => ({
          id,
          attendanceDate,
          checkedInAt,
          checkedOutAt,
          branch,
        }),
      ),
    };
  }

  async getMonthlyMatrix(
    userId: string,
    businessId: string,
    q: MonthlyMatrixQuery,
  ) {
    const { effectiveBranchId, business } = await this.scope.checkAccess(
      userId,
      businessId,
      'monthly_sheet',
      q.branchId,
    );

    let targetBranchId = effectiveBranchId;
    if (!targetBranchId) {
      const firstBranch = await this.scope.database.db.branch.findFirst({
        where: { businessId, status: 'ACTIVE' },
        orderBy: { name: 'asc' },
      });
      if (!firstBranch) throw new NotFoundException('No active branch found');
      targetBranchId = firstBranch.id;
    }

    const branch = await this.scope.database.db.branch.findUnique({
      where: { id: targetBranchId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const timezone = branch.timezone || business.timezone;
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
    });
    const parts = formatter.formatToParts(now);
    const currentYear = Number(parts.find((p) => p.type === 'year')?.value);
    const currentMonth = Number(parts.find((p) => p.type === 'month')?.value);

    const year = q.year ?? currentYear;
    const month = q.month ?? currentMonth;
    const monthStr = String(month).padStart(2, '0');

    const daysInMonth = new Date(year, month, 0).getDate();
    const startDate = `${year}-${monthStr}-01`;
    const endDate = `${year}-${monthStr}-${String(daysInMonth).padStart(2, '0')}`;
    const todayString = calendarToday(timezone);

    const days: MonthlyMatrixDay[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayDateStr = `${year}-${monthStr}-${String(d).padStart(2, '0')}`;
      const dt = new Date(`${dayDateStr}T00:00:00Z`);
      const dayOfWeekNum = dt.getUTCDay();
      days.push({
        date: dayDateStr,
        dayNumber: d,
        dayOfWeek: dayNames[dayOfWeekNum]!,
        isToday: dayDateStr === todayString,
        isPast: dayDateStr < todayString,
        isSunday: dayOfWeekNum === 0,
      });
    }

    const memberWhere = {
      businessId,
      branchId: targetBranchId,
      status: { not: 'ARCHIVED' as const },
      ...(q.search
        ? {
            OR: [
              { fullName: { contains: q.search, mode: 'insensitive' as const } },
              {
                memberNumber: { contains: q.search, mode: 'insensitive' as const },
              },
              { phone: { contains: q.search } },
            ],
          }
        : {}),
    };

    const members = await this.scope.database.db.member.findMany({
      where: memberWhere,
      select: {
        id: true,
        fullName: true,
        memberNumber: true,
        phone: true,
        status: true,
        memberships: {
          where: { cancelledAt: null },
          orderBy: { endDate: 'desc' },
          take: 1,
          select: {
            planNameSnapshot: true,
            endDate: true,
            receivable: {
              select: {
                originalAmountMinor: true,
                dueDate: true,
                payments: {
                  where: { status: 'RECORDED' },
                  select: { amountMinor: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
    });

    const attendanceRecords = await this.scope.database.db.attendance.findMany({
      where: {
        businessId,
        branchId: targetBranchId,
        attendanceDate: {
          gte: dateOnly(startDate),
          lte: dateOnly(endDate),
        },
      },
      select: {
        memberId: true,
        attendanceDate: true,
        status: true,
      },
    });

    const attendanceMap: Record<
      string,
      Record<string, 'PRESENT' | 'ABSENT' | 'REST'>
    > = {};
    const dailyTotals: Record<string, number> = {};

    for (const rec of attendanceRecords) {
      const dateStr = rec.attendanceDate.toISOString().slice(0, 10);
      if (!attendanceMap[rec.memberId]) attendanceMap[rec.memberId] = {};
      const st = (rec.status as 'PRESENT' | 'ABSENT' | 'REST') || 'PRESENT';
      attendanceMap[rec.memberId]![dateStr] = st;

      if (st === 'PRESENT') {
        dailyTotals[dateStr] = (dailyTotals[dateStr] || 0) + 1;
      }
    }

    const memberRows = members.map((m) => {
      const att = attendanceMap[m.id] || {};
      let totalPresent = 0;
      let totalAbsent = 0;
      let totalRest = 0;

      for (const d of days) {
        const val = att[d.date];
        if (val === 'PRESENT') totalPresent++;
        else if (val === 'ABSENT') totalAbsent++;
        else if (val === 'REST') totalRest++;
      }

      const elapsedDays = days.filter((d) => d.date <= todayString).length || 1;
      const attendanceRate = Math.min(
        100,
        Math.round((totalPresent / elapsedDays) * 100),
      );

      const latestMembership = m.memberships[0];
      let feeStatus: {
        status: 'PAID' | 'DUE' | 'NO_PLAN';
        outstandingMinor: number;
        currency: string;
        dueDate?: string | null;
      } = {
        status: 'NO_PLAN',
        outstandingMinor: 0,
        currency: business.currency,
      };

      if (latestMembership) {
        const rec = latestMembership.receivable;
        if (rec) {
          const totalPaid = rec.payments.reduce(
            (sum, p) => sum + p.amountMinor,
            0,
          );
          const outstanding = Math.max(0, rec.originalAmountMinor - totalPaid);
          feeStatus = {
            status: outstanding > 0 ? 'DUE' : 'PAID',
            outstandingMinor: outstanding,
            currency: business.currency,
            dueDate: rec.dueDate
              ? rec.dueDate.toISOString().slice(0, 10)
              : null,
          };
        } else {
          feeStatus = {
            status: 'PAID',
            outstandingMinor: 0,
            currency: business.currency,
          };
        }
      }

      return {
        memberId: m.id,
        fullName: m.fullName,
        memberNumber: m.memberNumber,
        phone: m.phone,
        planName: latestMembership?.planNameSnapshot || null,
        status: m.status as 'ACTIVE' | 'INACTIVE' | 'ARCHIVED',
        attendance: att,
        totalPresent,
        totalAbsent,
        totalRest,
        attendanceRate,
        feeStatus,
      };
    });

    const monthNameFormatter = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
    });
    const monthName = monthNameFormatter.format(
      new Date(`${startDate}T00:00:00Z`),
    );

    const totalDaysRecorded = Object.keys(dailyTotals).length || 1;
    const totalCheckinsSum = Object.values(dailyTotals).reduce(
      (a, b) => a + b,
      0,
    );
    const averageDailyCheckins = Math.round(
      totalCheckinsSum / totalDaysRecorded,
    );

    return wire({
      branch: { id: branch.id, name: branch.name },
      year,
      month,
      monthName,
      days,
      members: memberRows,
      dailyTotals,
      totalActiveMembers: members.filter((m) => m.status === 'ACTIVE').length,
      averageDailyCheckins,
      googleSheetsConfig: {
        connected: !!business.googleSheetId,
        sheetId: business.googleSheetId,
        lastSyncedAt:
          (business.googleSyncSettings as { lastSyncedAt?: string } | null)
            ?.lastSyncedAt || null,
      },
    });
  }

  async updateMatrixCell(
    userId: string,
    businessId: string,
    input: UpdateMatrixCellDto,
  ) {
    await this.scope.checkAccess(
      userId,
      businessId,
      'monthly_sheet',
      input.branchId,
    );
    return this.scope.write(userId, businessId, async (tx) => {
      const day = dateOnly(input.date);
      if (input.status === 'CLEAR') {
        await tx.attendance.deleteMany({
          where: {
            businessId,
            branchId: input.branchId,
            memberId: input.memberId,
            attendanceDate: day,
          },
        });
        return { cleared: true, memberId: input.memberId, date: input.date };
      }

      const membership = await tx.membership.findFirst({
        where: {
          businessId,
          memberId: input.memberId,
          branchId: input.branchId,
          cancelledAt: null,
        },
        orderBy: { endDate: 'desc' },
      });

      const attendance = await tx.attendance.upsert({
        where: {
          businessId_branchId_memberId_attendanceDate: {
            businessId,
            branchId: input.branchId,
            memberId: input.memberId,
            attendanceDate: day,
          },
        },
        create: {
          businessId,
          branchId: input.branchId,
          memberId: input.memberId,
          membershipId: membership?.id ?? null,
          attendanceDate: day,
          status: input.status,
          session: input.session ?? null,
          recordedByUserId: userId,
        },
        update: {
          status: input.status,
          session: input.session ?? undefined,
        },
      });

      await this.scope.audit(
        tx,
        businessId,
        userId,
        attendance.id,
        `ATTENDANCE_CELL_${input.status}`,
      );

      return wire(attendance);
    });
  }

  async markAllToday(
    userId: string,
    businessId: string,
    input: MarkAllTodayDto,
  ) {
    await this.scope.checkAccess(
      userId,
      businessId,
      'monthly_sheet',
      input.branchId,
    );
    return this.scope.write(userId, businessId, async (tx) => {
      const branch = await tx.branch.findUnique({
        where: { id: input.branchId },
        include: { business: true },
      });
      if (!branch) throw new NotFoundException('Branch not found');
      const today = dateOnly(
        calendarToday(branch.timezone || branch.business.timezone),
      );

      const activeMembers = await tx.member.findMany({
        where: {
          businessId,
          branchId: input.branchId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      for (const member of activeMembers) {
        const membership = await tx.membership.findFirst({
          where: {
            businessId,
            memberId: member.id,
            branchId: input.branchId,
            cancelledAt: null,
          },
          orderBy: { endDate: 'desc' },
        });

        await tx.attendance.upsert({
          where: {
            businessId_branchId_memberId_attendanceDate: {
              businessId,
              branchId: input.branchId,
              memberId: member.id,
              attendanceDate: today,
            },
          },
          create: {
            businessId,
            branchId: input.branchId,
            memberId: member.id,
            membershipId: membership?.id ?? null,
            attendanceDate: today,
            status: 'PRESENT',
            session: input.session ?? null,
            recordedByUserId: userId,
          },
          update: {
            status: 'PRESENT',
            session: input.session ?? undefined,
          },
        });
      }

      return {
        markedCount: activeMembers.length,
        date: today.toISOString().slice(0, 10),
      };
    });
  }

  async syncGoogleSheets(
    userId: string,
    businessId: string,
    input: GoogleSheetsSyncDto,
  ) {
    await this.scope.checkAccess(
      userId,
      businessId,
      'monthly_sheet',
      input.branchId,
    );
    const matrix = await this.getMonthlyMatrix(userId, businessId, {
      branchId: input.branchId,
      year: input.year,
      month: input.month,
    });

    const nowIso = new Date().toISOString();
    await this.scope.database.db.business.update({
      where: { id: businessId },
      data: {
        googleSheetId: input.sheetId || undefined,
        googleSyncSettings: {
          lastSyncedAt: nowIso,
          lastBranchId: input.branchId,
          lastYear: input.year,
          lastMonth: input.month,
          rowCount: matrix.members.length,
        },
      },
    });

    return {
      synced: true,
      lastSyncedAt: nowIso,
      sheetId: input.sheetId || null,
      rowCount: matrix.members.length,
      branchName: matrix.branch.name,
      monthName: matrix.monthName,
    };
  }
}
