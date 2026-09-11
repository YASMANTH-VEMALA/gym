import {
  ForbiddenException,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { Prisma } from '../generated/prisma/client';
import { isCalendarDate } from '@gym/validation';
export function dateOnly(value: string) {
  if (!isCalendarDate(value))
    throw new BadRequestException(
      'Enter a valid calendar date on or after 1900-01-01.',
    );
  return new Date(`${value}T00:00:00.000Z`);
}
export function wire<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item: unknown) => {
      if (typeof item !== 'bigint') return item;
      const number = Number(item);
      if (!Number.isSafeInteger(number))
        throw new Error('Aggregate exceeds supported numeric range');
      return number;
    }),
  ) as T;
}
@Injectable()
export class BusinessScope {
  constructor(readonly database: DatabaseService) {}

  async getAccessRecord(
    userId: string,
    businessId: string,
    tx: Prisma.TransactionClient = this.database.db,
  ) {
    const access = await tx.businessAccess.findUnique({
      where: { businessId_userId: { businessId, userId } },
      include: { business: true },
    });
    if (!access || !['OWNER', 'ADMIN', 'MANAGER'].includes(access.role))
      throw new ForbiddenException('You do not have access to this business');
    return access;
  }

  async access(
    userId: string,
    businessId: string,
    tx: Prisma.TransactionClient = this.database.db,
  ) {
    const access = await this.getAccessRecord(userId, businessId, tx);
    return access.business;
  }

  async checkAccess(
    userId: string,
    businessId: string,
    requiredSection?: string,
    requestedBranchId?: string,
    tx: Prisma.TransactionClient = this.database.db,
  ) {
    const access = await this.getAccessRecord(userId, businessId, tx);

    // 1. Check section permission for managers
    if (requiredSection && access.role === 'MANAGER' && access.permissions) {
      const perms = Array.isArray(access.permissions)
        ? (access.permissions as string[])
        : [];
      if (!perms.includes(requiredSection)) {
        throw new ForbiddenException(
          `You do not have permission to access ${requiredSection}`,
        );
      }
    }

    // 2. Check branch scoping
    let effectiveBranchId = requestedBranchId;
    if (access.assignedBranchId) {
      if (
        requestedBranchId &&
        requestedBranchId !== access.assignedBranchId
      ) {
        throw new ForbiddenException(
          'You only have access to your assigned branch',
        );
      }
      effectiveBranchId = access.assignedBranchId;
    } else if (requestedBranchId) {
      await this.branch(businessId, requestedBranchId);
    }

    return {
      business: access.business,
      access,
      effectiveBranchId,
    };
  }

  async branch(businessId: string, branchId?: string) {
    if (
      branchId &&
      !(await this.database.db.branch.findFirst({
        where: { id: branchId, businessId },
      }))
    )
      throw new ForbiddenException('Branch does not belong to this business');
  }

  async write<T>(
    userId: string,
    businessId: string,
    action: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    return this.database.db.$transaction(
      async (tx) => {
        await this.access(userId, businessId, tx);
        await tx.$queryRaw`SELECT id FROM "Business" WHERE id=${businessId}::uuid FOR UPDATE`;
        return action(tx);
      },
      { timeout: 15000 },
    );
  }

  audit(
    tx: Prisma.TransactionClient,
    businessId: string,
    userId: string,
    targetId: string,
    action: string,
  ) {
    return tx.auditEvent.create({
      data: { businessId, actorId: userId, targetId, action },
    });
  }
}
