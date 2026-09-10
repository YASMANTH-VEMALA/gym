import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { calendarToday } from '@gym/validation';
import { BusinessScope, dateOnly, wire } from '../../common/business-scope';
import { AttendanceQuery, CheckInDto } from './attendance.dto';
@Injectable()
export class AttendanceService {
  constructor(private readonly scope: BusinessScope) {}
  async list(userId: string, businessId: string, q: AttendanceQuery) {
    await this.scope.access(userId, businessId);
    await this.scope.branch(businessId, q.branchId);
    return this.history(businessId, q);
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
}
