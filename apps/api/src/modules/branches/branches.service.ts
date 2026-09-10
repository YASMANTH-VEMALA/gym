import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { BranchDetail, BranchList, BranchRecord } from '@gym/types';
import { ledger } from '../finance/ledger';
import { todayCheckIns } from '../../common/attendance-metrics';
import { DatabaseService } from '../../database/database.service';
import { Prisma, type Branch } from '../../generated/prisma/client';
import {
  CreateBranchDto,
  ListBranchesDto,
  UpdateBranchDto,
} from './branches.dto';

function record(branch: Branch, staffCount = 0, memberCount = 0): BranchRecord {
  return {
    ...branch,
    createdAt: branch.createdAt.toISOString(),
    updatedAt: branch.updatedAt.toISOString(),
    archivedAt: branch.archivedAt?.toISOString() ?? null,
    memberCount,
    staffCount,
  };
}
@Injectable()
export class BranchesService {
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
    return access.role;
  }
  private async branch(
    tx: Prisma.TransactionClient,
    businessId: string,
    id: string,
  ) {
    const branch = await tx.branch.findFirst({ where: { id, businessId } });
    if (!branch)
      throw new NotFoundException('Branch not found in this business');
    return branch;
  }
  private checkTimezone(timezone?: string | null) {
    if (!timezone) return;
    try {
      new Intl.DateTimeFormat('en', { timeZone: timezone });
    } catch {
      throw new BadRequestException('Enter a valid IANA timezone');
    }
  }
  private audit(
    tx: Prisma.TransactionClient,
    userId: string,
    branch: Branch,
    action: string,
  ) {
    return tx.auditEvent.create({
      data: {
        businessId: branch.businessId,
        actorId: userId,
        targetId: branch.id,
        action,
        metadata: { branchName: branch.name },
      },
    });
  }
  private async write<T>(
    businessId: string,
    userId: string,
    action: (tx: Prisma.TransactionClient, role: string) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.database.db.$transaction(async (tx) => {
        const role = await this.access(tx, businessId, userId);
        // All branch writes serialize per business, including concurrent archives.
        await tx.$queryRaw`SELECT id FROM "Business" WHERE id = ${businessId}::uuid FOR UPDATE`;
        return action(tx, role);
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      )
        throw new ConflictException({
          code: 'DUPLICATE_BRANCH_CODE',
          message: 'This branch code is already used in this business.',
        });
      throw error;
    }
  }
  async list(
    userId: string,
    businessId: string,
    query: ListBranchesDto,
  ): Promise<BranchList> {
    await this.access(this.database.db, businessId, userId);
    const where: Prisma.BranchWhereInput = {
      businessId,
      ...(query.status === 'ALL' ? {} : { status: query.status }),
      ...(query.search
        ? {
            OR: [
              'name',
              'code',
              'addressLine1',
              'city',
              'state',
              'country',
              'postalCode',
            ].map((field) => ({
              [field]: { contains: query.search, mode: 'insensitive' },
            })),
          }
        : {}),
    };
    const [total, items] = await this.database.db.$transaction(
      [
        this.database.db.branch.count({ where }),
        this.database.db.branch.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    const assignments = items.length
      ? await this.database.db.staffBranchAssignment.findMany({
          where: {
            branchId: { in: items.map((item) => item.id) },
            staff: { status: 'ACTIVE' },
          },
          select: { branchId: true },
        })
      : [];
    const staffCounts = assignments.reduce(
      (counts, item) =>
        counts.set(item.branchId, (counts.get(item.branchId) || 0) + 1),
      new Map<string, number>(),
    );
    const memberCounts = await this.database.db.member.groupBy({
      by: ['branchId'],
      where: {
        businessId,
        branchId: { in: items.map((b) => b.id) },
        status: { not: 'ARCHIVED' },
      },
      _count: true,
    });
    return {
      items: items.map((item) =>
        record(
          item,
          staffCounts.get(item.id) || 0,
          memberCounts.find((m) => m.branchId === item.id)?._count || 0,
        ),
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
  ): Promise<BranchDetail> {
    await this.access(this.database.db, businessId, userId);
    const branch = await this.branch(this.database.db, businessId, id);
    const business = await this.database.db.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { name: true, currency: true, timezone: true },
    });
    const staffCount = await this.database.db.staff.count({
      where: {
        status: 'ACTIVE',
        branchAssignments: { some: { branchId: id } },
      },
    });
    const memberCount = await this.database.db.member.count({
      where: { businessId, branchId: id, status: { not: 'ARCHIVED' } },
    });
    const [finance] = await this.database.db.$queryRaw<
      Array<{
        activeMemberships: bigint;
        outstanding: bigint;
        collections: bigint;
      }>
    >(
      Prisma.sql`${ledger(businessId)} SELECT count(*) FILTER(WHERE "cancelledAt" IS NULL AND today BETWEEN "startDate" AND "endDate")::bigint AS "activeMemberships", COALESCE(sum("outstandingMinor"),0)::bigint AS outstanding,(SELECT COALESCE(sum(p."amountMinor"),0)::bigint FROM "Payment" p JOIN "Receivable" r ON r.id=p."receivableId" JOIN "Membership" m ON m.id=r."membershipId" JOIN "Business" b ON b.id=p."businessId" WHERE p."businessId"=${businessId}::uuid AND m."branchId"=${id}::uuid AND p.status='RECORDED' AND p."paidAt" BETWEEN date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE b.timezone)::date AND (CURRENT_TIMESTAMP AT TIME ZONE b.timezone)::date) AS collections FROM ledger WHERE "branchId"=${id}::uuid`,
    );
    return {
      ...record(branch, staffCount, memberCount),
      business,
      effectiveTimezone: branch.timezone || business.timezone,
      metrics: {
        members: memberCount,
        activeMemberships: Number(finance?.activeMemberships || 0),
        staff: staffCount,
        todayCheckIns: await todayCheckIns(this.database.db, businessId, id),
        outstandingDues: Number(finance?.outstanding || 0),
        collections: Number(finance?.collections || 0),
      },
    };
  }
  async create(userId: string, businessId: string, input: CreateBranchDto) {
    this.checkTimezone(input.timezone);
    return this.write(businessId, userId, async (tx) => {
      let code = input.code;
      if (!code) {
        let next = (await tx.branch.count({ where: { businessId } })) + 1;
        do {
          code = `BR${String(next++).padStart(4, '0')}`;
        } while (
          await tx.branch.findUnique({
            where: { businessId_code: { businessId, code } },
          })
        );
      }
      const branch = await tx.branch.create({
        data: { ...input, code, businessId },
      });
      await this.audit(tx, userId, branch, 'BRANCH_CREATED');
      return record(branch);
    });
  }
  async update(
    userId: string,
    businessId: string,
    id: string,
    input: UpdateBranchDto,
  ) {
    this.checkTimezone(input.timezone);
    return this.write(businessId, userId, async (tx) => {
      const current = await this.branch(tx, businessId, id);
      if (current.status === 'ARCHIVED')
        throw new ConflictException({
          code: 'BRANCH_ARCHIVED',
          message: 'Archived branches are read-only.',
        });
      const branch = await tx.branch.update({
        where: { id },
        data: { ...input, code: input.code || current.code },
      });
      await this.audit(tx, userId, branch, 'BRANCH_UPDATED');
      return record(branch);
    });
  }
  async archive(userId: string, businessId: string, id: string) {
    return this.write(businessId, userId, async (tx, role) => {
      const current = await this.branch(tx, businessId, id);
      if (role !== 'OWNER')
        throw new ForbiddenException('Only the Owner can archive branches');
      if (current.status === 'ARCHIVED') return record(current);
      if (
        (await tx.branch.count({ where: { businessId, status: 'ACTIVE' } })) <=
        1
      )
        throw new ConflictException({
          code: 'LAST_ACTIVE_BRANCH',
          message:
            'Your business must keep at least one active branch. Create another branch before archiving this one.',
        });
      const branch = await tx.branch.update({
        where: { id },
        data: { status: 'ARCHIVED', archivedAt: new Date() },
      });
      await this.audit(tx, userId, branch, 'BRANCH_ARCHIVED');
      return record(branch);
    });
  }
}
