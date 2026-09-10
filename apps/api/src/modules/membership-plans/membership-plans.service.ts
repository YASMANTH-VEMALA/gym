import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  MembershipPlanDetail,
  MembershipPlanList,
  MembershipPlanRecord,
} from '@gym/types';
import { DatabaseService } from '../../database/database.service';
import { Prisma } from '../../generated/prisma/client';
import {
  CreateMembershipPlanDto,
  ListMembershipPlansDto,
  UpdateMembershipPlanDto,
} from './membership-plans.dto';
const include = {
  branchAssignments: {
    include: { branch: { select: { id: true, name: true, status: true } } },
    orderBy: { branch: { name: 'asc' as const } },
  },
};
type Plan = Prisma.MembershipPlanGetPayload<{ include: typeof include }>;
function record(plan: Plan, activeMembers = 0): MembershipPlanRecord {
  const { branchAssignments, ...data } = plan;
  return {
    ...data,
    branches: branchAssignments.map((item) => item.branch),
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    archivedAt: plan.archivedAt?.toISOString() ?? null,
    activeMembers,
  };
}
@Injectable()
export class MembershipPlansService {
  constructor(private readonly database: DatabaseService) {}
  private async access(
    tx: Prisma.TransactionClient,
    businessId: string,
    userId: string,
  ) {
    const access = await tx.businessAccess.findUnique({
      where: { businessId_userId: { businessId, userId } },
    });
    if (!access || !['OWNER', 'ADMIN'].includes(access.role))
      throw new ForbiddenException('You do not have access to this business');
  }
  private async find(
    tx: Prisma.TransactionClient,
    businessId: string,
    id: string,
  ) {
    const plan = await tx.membershipPlan.findFirst({
      where: { id, businessId },
      include,
    });
    if (!plan)
      throw new NotFoundException('Membership plan not found in this business');
    return plan;
  }
  private async write<T>(
    userId: string,
    businessId: string,
    action: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    return this.database.db.$transaction(async (tx) => {
      await this.access(tx, businessId, userId);
      await tx.$queryRaw`SELECT id FROM "Business" WHERE id = ${businessId}::uuid FOR UPDATE`;
      return action(tx);
    });
  }
  private audit(
    tx: Prisma.TransactionClient,
    userId: string,
    plan: Plan,
    action: string,
  ) {
    return tx.auditEvent.create({
      data: {
        businessId: plan.businessId,
        actorId: userId,
        targetId: plan.id,
        action,
        metadata: { planName: plan.name },
      },
    });
  }
  private async validateBranches(
    tx: Prisma.TransactionClient,
    businessId: string,
    all: boolean,
    ids: string[],
    existing: Plan | null,
  ) {
    if (all) {
      if (ids.length)
        throw new BadRequestException(
          'All-branch plans cannot have selected branch assignments.',
        );
      return;
    }
    if (!ids.length)
      throw new BadRequestException('Select at least one active branch.');
    const branches = await tx.branch.findMany({
      where: { businessId, id: { in: ids } },
      select: { id: true, status: true },
    });
    if (branches.length !== ids.length)
      throw new BadRequestException({
        code: 'INVALID_PLAN_BRANCH',
        message: 'Every selected branch must belong to this business.',
      });
    if (
      branches.some(
        (branch) =>
          branch.status !== 'ACTIVE' &&
          !existing?.branchAssignments.some(
            (item) => item.branchId === branch.id,
          ),
      )
    )
      throw new ConflictException({
        code: 'ARCHIVED_PLAN_BRANCH',
        message: 'Archived branches cannot be added to a plan.',
      });
  }
  async list(
    userId: string,
    businessId: string,
    query: ListMembershipPlansDto,
  ): Promise<MembershipPlanList> {
    await this.access(this.database.db, businessId, userId);
    if (query.branchId) {
      const branch = await this.database.db.branch.findFirst({
        where: { businessId, id: query.branchId },
      });
      if (!branch)
        throw new NotFoundException('Branch filter not found in this business');
      if (branch.status !== 'ACTIVE')
        throw new BadRequestException(
          'Choose an active branch for plan availability.',
        );
    }
    const where: Prisma.MembershipPlanWhereInput = {
      businessId,
      ...(query.status === 'ALL' ? {} : { status: query.status }),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.branchId
        ? {
            OR: [
              { appliesToAllBranches: true },
              {
                appliesToAllBranches: false,
                branchAssignments: { some: { branchId: query.branchId } },
              },
            ],
          }
        : {}),
    };
    const [total, items] = await this.database.db.$transaction(
      [
        this.database.db.membershipPlan.count({ where }),
        this.database.db.membershipPlan.findMany({
          where,
          include,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    const active = await this.database.db.$queryRaw<
      Array<{ planId: string; count: number }>
    >(
      Prisma.sql`SELECT m."planId",count(DISTINCT m."memberId")::int AS count FROM "Membership" m JOIN "Business" b ON b.id=m."businessId" WHERE m."businessId"=${businessId}::uuid AND m."cancelledAt" IS NULL AND (CURRENT_TIMESTAMP AT TIME ZONE b.timezone)::date BETWEEN m."startDate" AND m."endDate" ${query.branchId ? Prisma.sql`AND m."branchId"=${query.branchId}::uuid` : Prisma.empty} GROUP BY m."planId"`,
    );
    return {
      items: items.map((plan) =>
        record(plan, active.find((a) => a.planId === plan.id)?.count || 0),
      ),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
  async get(
    userId: string,
    businessId: string,
    id: string,
  ): Promise<MembershipPlanDetail> {
    await this.access(this.database.db, businessId, userId);
    const plan = await this.find(this.database.db, businessId, id);
    const business = await this.database.db.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { name: true, currency: true, timezone: true },
    });
    const eligibleBranches =
      plan.status === 'ACTIVE'
        ? await this.database.db.branch.findMany({
            where: {
              businessId,
              status: 'ACTIVE',
              ...(plan.appliesToAllBranches
                ? {}
                : {
                    id: {
                      in: plan.branchAssignments.map((item) => item.branchId),
                    },
                  }),
            },
            select: { id: true, name: true, status: true },
            orderBy: { name: 'asc' },
          })
        : [];
    const [metrics] = await this.database.db.$queryRaw<
      Array<{
        activeMembers: number;
        totalMembers: number;
        revenueMinor: bigint;
      }>
    >(
      Prisma.sql`SELECT count(DISTINCT m."memberId") FILTER(WHERE m."cancelledAt" IS NULL AND (CURRENT_TIMESTAMP AT TIME ZONE b.timezone)::date BETWEEN m."startDate" AND m."endDate")::int AS "activeMembers",count(DISTINCT m."memberId")::int AS "totalMembers",(SELECT COALESCE(sum(p."amountMinor"),0)::bigint FROM "Payment" p JOIN "Receivable" r ON r.id=p."receivableId" JOIN "Membership" mm ON mm.id=r."membershipId" WHERE p."businessId"=${businessId}::uuid AND mm."planId"=${id}::uuid AND p.status='RECORDED') AS "revenueMinor" FROM "Membership" m JOIN "Business" b ON b.id=m."businessId" WHERE m."businessId"=${businessId}::uuid AND m."planId"=${id}::uuid`,
    );
    return {
      ...record(plan, metrics?.activeMembers || 0),
      business,
      eligibleBranches,
      metrics: {
        activeMembers: metrics?.activeMembers || 0,
        totalMembers: metrics?.totalMembers || 0,
        revenueMinor: Number(metrics?.revenueMinor || 0),
      },
    };
  }
  async create(
    userId: string,
    businessId: string,
    input: CreateMembershipPlanDto,
  ) {
    return this.write(userId, businessId, async (tx) => {
      const { branchIds = [], appliesToAllBranches = true, ...data } = input;
      await this.validateBranches(
        tx,
        businessId,
        appliesToAllBranches,
        branchIds,
        null,
      );
      const plan = await tx.membershipPlan.create({
        data: {
          ...data,
          businessId,
          appliesToAllBranches,
          branchAssignments: {
            create: branchIds.map((branchId) => ({ branchId })),
          },
        },
        include,
      });
      await this.audit(tx, userId, plan, 'MEMBERSHIP_PLAN_CREATED');
      return record(plan);
    });
  }
  async update(
    userId: string,
    businessId: string,
    id: string,
    input: UpdateMembershipPlanDto,
  ) {
    return this.write(userId, businessId, async (tx) => {
      const current = await this.find(tx, businessId, id);
      if (current.status === 'ARCHIVED')
        throw new ConflictException({
          code: 'PLAN_ARCHIVED',
          message: 'Archived plans are read-only.',
        });
      const { branchIds: requested, ...data } = input;
      const all = input.appliesToAllBranches ?? current.appliesToAllBranches;
      const ids =
        requested ??
        (all ? [] : current.branchAssignments.map((item) => item.branchId));
      await this.validateBranches(tx, businessId, all, ids, current);
      const plan = await tx.membershipPlan.update({
        where: { id },
        data: {
          ...data,
          branchAssignments: {
            deleteMany: { branchId: { notIn: ids } },
            create: ids
              .filter(
                (branchId) =>
                  !current.branchAssignments.some(
                    (item) => item.branchId === branchId,
                  ),
              )
              .map((branchId) => ({ branchId })),
          },
        },
        include,
      });
      await this.audit(tx, userId, plan, 'MEMBERSHIP_PLAN_UPDATED');
      return record(plan);
    });
  }
  async archive(userId: string, businessId: string, id: string) {
    return this.write(userId, businessId, async (tx) => {
      const current = await this.find(tx, businessId, id);
      if (current.status === 'ARCHIVED') return record(current);
      const plan = await tx.membershipPlan.update({
        where: { id },
        data: { status: 'ARCHIVED', archivedAt: new Date() },
        include,
      });
      await this.audit(tx, userId, plan, 'MEMBERSHIP_PLAN_ARCHIVED');
      return record(plan);
    });
  }
}
