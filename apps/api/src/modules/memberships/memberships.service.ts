import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { calendarToday } from '@gym/validation';
import { BusinessScope, dateOnly, wire } from '../../common/business-scope';
import type { Prisma } from '../../generated/prisma/client';
import { CreateMembershipDto, MembershipQuery } from './memberships.dto';
const include = {
  member: { select: { id: true, fullName: true, memberNumber: true } },
  branch: { select: { id: true, name: true } },
  business: { select: { currency: true, timezone: true } },
};
export function membershipStatus(
  start: string,
  end: string,
  cancelled: unknown,
  today: string,
) {
  return cancelled
    ? 'CANCELLED'
    : start > today
      ? 'UPCOMING'
      : end < today
        ? 'EXPIRED'
        : 'ACTIVE';
}
@Injectable()
export class MembershipsService {
  constructor(private readonly scope: BusinessScope) {}
  async list(userId: string, businessId: string, q: MembershipQuery) {
    const business = await this.scope.access(userId, businessId);
    await this.scope.branch(businessId, q.branchId);
    if (
      q.memberId &&
      !(await this.scope.database.db.member.findFirst({
        where: { id: q.memberId, businessId },
      }))
    )
      throw new NotFoundException('Member not found in this business');
    if (
      q.planId &&
      !(await this.scope.database.db.membershipPlan.findFirst({
        where: { id: q.planId, businessId },
      }))
    )
      throw new NotFoundException('Plan not found in this business');
    const today = dateOnly(calendarToday(business.timezone));
    const where: Prisma.MembershipWhereInput = {
      businessId,
      memberId: q.memberId,
      branchId: q.branchId,
      planId: q.planId,
      ...(q.search
        ? {
            member: {
              OR: [
                { fullName: { contains: q.search, mode: 'insensitive' } },
                { memberNumber: { contains: q.search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
      ...(q.status === 'CANCELLED'
        ? { cancelledAt: { not: null } }
        : q.status === 'ALL'
          ? {}
          : {
              cancelledAt: null,
              ...(q.status === 'ACTIVE'
                ? { startDate: { lte: today }, endDate: { gte: today } }
                : q.status === 'UPCOMING'
                  ? { startDate: { gt: today } }
                  : { endDate: { lt: today } }),
            }),
    };
    const [total, items] = await this.scope.database.db.$transaction([
      this.scope.database.db.membership.count({ where }),
      this.scope.database.db.membership.findMany({
        where,
        include,
        orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return {
      total,
      page: q.page,
      pageSize: q.pageSize,
      items: items.map((item) => ({
        ...wire(item),
        startDate: item.startDate.toISOString().slice(0, 10),
        endDate: item.endDate.toISOString().slice(0, 10),
        status: membershipStatus(
          item.startDate.toISOString().slice(0, 10),
          item.endDate.toISOString().slice(0, 10),
          item.cancelledAt,
          calendarToday(business.timezone),
        ),
      })),
    };
  }
  async get(userId: string, businessId: string, id: string) {
    await this.scope.access(userId, businessId);
    const item = await this.scope.database.db.membership.findFirst({
      where: { id, businessId },
      include,
    });
    if (!item)
      throw new NotFoundException('Membership not found in this business');
    return {
      ...wire(item),
      startDate: item.startDate.toISOString().slice(0, 10),
      endDate: item.endDate.toISOString().slice(0, 10),
      status: membershipStatus(
        item.startDate.toISOString().slice(0, 10),
        item.endDate.toISOString().slice(0, 10),
        item.cancelledAt,
        calendarToday(item.business.timezone),
      ),
    };
  }
  create(userId: string, businessId: string, input: CreateMembershipDto) {
    return this.scope.write(userId, businessId, async (tx) => {
      const prior = await tx.membership.findUnique({
        where: {
          businessId_idempotencyKey: {
            businessId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (prior) {
        if (
          prior.memberId !== input.memberId ||
          prior.branchId !== input.branchId ||
          prior.planId !== input.planId ||
          prior.startDate.toISOString().slice(0, 10) !== input.startDate
        )
          throw new ConflictException(
            'Idempotency key was used with different membership details',
          );
        return wire(prior);
      }
      const member = await tx.member.findFirst({
        where: { id: input.memberId, businessId, status: 'ACTIVE' },
      });
      const branch = await tx.branch.findFirst({
        where: { id: input.branchId, businessId, status: 'ACTIVE' },
      });
      const plan = await tx.membershipPlan.findFirst({
        where: { id: input.planId, businessId, status: 'ACTIVE' },
        include: { branchAssignments: true },
      });
      if (!member || !branch || !plan)
        throw new BadRequestException(
          'Choose an active member, branch and plan in this business',
        );
      if (
        !plan.appliesToAllBranches &&
        !plan.branchAssignments.some((x) => x.branchId === branch.id)
      )
        throw new BadRequestException(
          'This plan is not available at the selected branch',
        );
      const startDate = dateOnly(input.startDate),
        endDate = new Date(startDate);
      endDate.setUTCDate(endDate.getUTCDate() + plan.durationDays - 1);
      if (
        await tx.membership.findFirst({
          where: {
            businessId,
            memberId: member.id,
            branchId: branch.id,
            cancelledAt: null,
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        })
      )
        throw new ConflictException(
          'This member already has an overlapping membership at this branch',
        );
      const membership = await tx.membership.create({
        data: {
          businessId,
          ...input,
          startDate,
          endDate,
          planNameSnapshot: plan.name,
          priceMinorSnapshot: plan.priceMinor,
          durationDaysSnapshot: plan.durationDays,
        },
      });
      await tx.receivable.create({
        data: {
          businessId,
          membershipId: membership.id,
          originalAmountMinor: membership.priceMinorSnapshot,
          dueDate: membership.startDate,
        },
      });
      await this.scope.audit(
        tx,
        businessId,
        userId,
        membership.id,
        'MEMBERSHIP_CREATED',
      );
      return wire(membership);
    });
  }
  cancel(userId: string, businessId: string, id: string, reason: string) {
    return this.scope.write(userId, businessId, async (tx) => {
      const item = await tx.membership.findFirst({ where: { id, businessId } });
      if (!item)
        throw new NotFoundException('Membership not found in this business');
      if (item.cancelledAt) return wire(item);
      const changed = await tx.membership.update({
        where: { id },
        data: { cancelledAt: new Date(), cancelReason: reason },
      });
      await this.scope.audit(
        tx,
        businessId,
        userId,
        id,
        'MEMBERSHIP_CANCELLED',
      );
      return wire(changed);
    });
  }
}
