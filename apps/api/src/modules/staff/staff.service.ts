import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { StaffDetail, StaffList, StaffRecord } from '@gym/types';
import { DatabaseService } from '../../database/database.service';
import type { Prisma } from '../../generated/prisma/client';
import { CreateStaffDto, ListStaffDto, UpdateStaffDto } from './staff.dto';

const include = {
  branchAssignments: {
    include: { branch: true },
    orderBy: { branch: { name: 'asc' as const } },
  },
};
type StaffWithBranches = Prisma.StaffGetPayload<{ include: typeof include }>;
const date = (value: Date | null) =>
  value ? value.toISOString().slice(0, 10) : null;
function record(staff: StaffWithBranches): StaffRecord {
  return {
    id: staff.id,
    businessId: staff.businessId,
    fullName: staff.fullName,
    phone: staff.phone,
    email: staff.email,
    jobTitle: staff.jobTitle,
    gender: staff.gender,
    dateOfBirth: date(staff.dateOfBirth),
    joiningDate: date(staff.joiningDate)!,
    address: staff.address,
    emergencyContactName: staff.emergencyContactName,
    emergencyContactPhone: staff.emergencyContactPhone,
    status: staff.status,
    notes: staff.notes,
    branches: staff.branchAssignments.map(({ branch }) => ({
      id: branch.id,
      name: branch.name,
      code: branch.code,
      status: branch.status,
    })),
    createdAt: staff.createdAt.toISOString(),
    updatedAt: staff.updatedAt.toISOString(),
    archivedAt: staff.archivedAt?.toISOString() ?? null,
  };
}
const parseDate = (value: string | null | undefined, field: string) => {
  if (!value) return value === null ? null : undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.valueOf()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException(`${field} must be a valid calendar date`);
  return parsed;
};

@Injectable()
export class StaffService {
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
    const staff = await tx.staff.findFirst({
      where: { id, businessId },
      include,
    });
    if (!staff)
      throw new NotFoundException('Staff member not found in this business');
    return staff;
  }
  private audit(
    tx: Prisma.TransactionClient,
    userId: string,
    staff: { id: string; businessId: string; fullName: string },
    action: string,
  ) {
    return tx.auditEvent.create({
      data: {
        businessId: staff.businessId,
        actorId: userId,
        targetId: staff.id,
        action,
        metadata: { staffName: staff.fullName },
      },
    });
  }
  private async write<T>(
    businessId: string,
    userId: string,
    action: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    return this.database.db.$transaction(async (tx) => {
      await this.access(tx, businessId, userId);
      await tx.$queryRaw`SELECT id FROM "Business" WHERE id = ${businessId}::uuid FOR UPDATE`;
      return action(tx);
    });
  }
  private async validateBranches(
    tx: Prisma.TransactionClient,
    businessId: string,
    ids: string[],
    existing = new Set<string>(),
  ) {
    const branches = await tx.branch.findMany({
      where: { id: { in: ids }, businessId },
      select: { id: true, status: true },
    });
    if (branches.length !== ids.length)
      throw new BadRequestException({
        code: 'INVALID_BRANCH_ASSIGNMENT',
        message: 'Every assigned branch must belong to this business.',
      });
    if (
      branches.some(
        (branch) => branch.status !== 'ACTIVE' && !existing.has(branch.id),
      )
    )
      throw new ConflictException({
        code: 'ARCHIVED_BRANCH_ASSIGNMENT',
        message: 'Archived branches cannot receive new staff assignments.',
      });
  }
  async list(
    userId: string,
    businessId: string,
    query: ListStaffDto,
  ): Promise<StaffList> {
    await this.access(this.database.db, businessId, userId);
    if (
      query.branchId &&
      !(await this.database.db.branch.findFirst({
        where: { id: query.branchId, businessId },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Branch filter not found in this business');
    const where: Prisma.StaffWhereInput = {
      businessId,
      ...(query.status === 'ALL' ? {} : { status: query.status }),
      ...(query.search
        ? {
            OR: ['fullName', 'phone', 'email'].map((field) => ({
              [field]: { contains: query.search, mode: 'insensitive' },
            })),
          }
        : {}),
      ...(query.jobTitle
        ? { jobTitle: { equals: query.jobTitle, mode: 'insensitive' } }
        : {}),
      ...(query.branchId
        ? { branchAssignments: { some: { branchId: query.branchId } } }
        : {}),
    };
    const [total, items] = await this.database.db.$transaction(
      [
        this.database.db.staff.count({ where }),
        this.database.db.staff.findMany({
          where,
          include,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return {
      items: items.map(record),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
  async get(
    userId: string,
    businessId: string,
    id: string,
  ): Promise<StaffDetail> {
    await this.access(this.database.db, businessId, userId);
    const staff = await this.find(this.database.db, businessId, id);
    const business = await this.database.db.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { name: true, timezone: true },
    });
    const events = await this.database.db.auditEvent.findMany({
      where: {
        businessId,
        targetId: id,
        action: { in: ['STAFF_CREATED', 'STAFF_UPDATED', 'STAFF_ARCHIVED'] },
      },
      select: { id: true, action: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });
    return {
      ...record(staff),
      business,
      activity: events.map((e) => ({
        id: e.id,
        action: e.action,
        occurredAt: e.createdAt.toISOString(),
      })),
    };
  }
  async create(userId: string, businessId: string, input: CreateStaffDto) {
    const joiningDate = parseDate(input.joiningDate, 'Joining date')!;
    const dateOfBirth = parseDate(input.dateOfBirth, 'Date of birth');
    return this.write(businessId, userId, async (tx) => {
      await this.validateBranches(tx, businessId, input.branchIds);
      const { branchIds, ...data } = input;
      const staff = await tx.staff.create({
        data: {
          ...data,
          joiningDate,
          dateOfBirth,
          businessId,
          branchAssignments: {
            create: branchIds.map((branchId) => ({ branchId })),
          },
        },
        include,
      });
      await this.audit(tx, userId, staff, 'STAFF_CREATED');
      return record(staff);
    });
  }
  async update(
    userId: string,
    businessId: string,
    id: string,
    input: UpdateStaffDto,
  ) {
    const joiningDate = parseDate(input.joiningDate, 'Joining date');
    const dateOfBirth = parseDate(input.dateOfBirth, 'Date of birth');
    if (joiningDate === null)
      throw new BadRequestException('Joining date cannot be null');
    return this.write(businessId, userId, async (tx) => {
      const current = await this.find(tx, businessId, id);
      if (current.status === 'ARCHIVED')
        throw new ConflictException({
          code: 'STAFF_ARCHIVED',
          message: 'Archived staff records are read-only.',
        });
      if (input.branchIds)
        await this.validateBranches(
          tx,
          businessId,
          input.branchIds,
          new Set(current.branchAssignments.map((item) => item.branchId)),
        );
      const {
        branchIds,
        joiningDate: ignoredJoiningDate,
        dateOfBirth: ignoredDateOfBirth,
        ...data
      } = input;
      void ignoredJoiningDate;
      void ignoredDateOfBirth;
      await tx.staff.update({
        where: { id },
        data: {
          ...data,
          ...(joiningDate !== undefined ? { joiningDate } : {}),
          ...(dateOfBirth !== undefined ? { dateOfBirth } : {}),
          ...(branchIds
            ? {
                branchAssignments: {
                  deleteMany: { branchId: { notIn: branchIds } },
                  create: branchIds
                    .filter(
                      (branchId) =>
                        !current.branchAssignments.some(
                          (item) => item.branchId === branchId,
                        ),
                    )
                    .map((branchId) => ({ branchId })),
                },
              }
            : {}),
        },
      });
      const staff = await this.find(tx, businessId, id);
      await this.audit(tx, userId, staff, 'STAFF_UPDATED');
      return record(staff);
    });
  }
  async archive(userId: string, businessId: string, id: string) {
    return this.write(businessId, userId, async (tx) => {
      const current = await this.find(tx, businessId, id);
      if (current.status === 'ARCHIVED') return record(current);
      const staff = await tx.staff.update({
        where: { id },
        data: { status: 'ARCHIVED', archivedAt: new Date() },
        include,
      });
      await this.audit(tx, userId, staff, 'STAFF_ARCHIVED');
      return record(staff);
    });
  }
}
