import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  EmergencyContact,
  MemberDetail,
  MemberList,
  MemberRecord,
} from '@gym/types';
import {
  calendarToday,
  isCalendarDate,
  normalizeMemberPhone,
} from '@gym/validation';
import { DatabaseService } from '../../database/database.service';
import { Prisma, type Member } from '../../generated/prisma/client';
import { ledger } from '../finance/ledger';
import {
  CreateMemberDto,
  ListMembersDto,
  UpdateMemberDto,
} from './members.dto';
function record(member: Member): MemberRecord {
  const { currentPhone, emergencyContacts, ...data } = member;
  void currentPhone;
  return {
    ...data,
    emergencyContacts: Array.isArray(emergencyContacts)
      ? (emergencyContacts as unknown as EmergencyContact[])
      : [],
    dateOfBirth: member.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    joiningDate: member.joiningDate.toISOString().slice(0, 10),
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
    archivedAt: member.archivedAt?.toISOString() ?? null,
  };
}
@Injectable()
export class MembersService {
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
    const member = await tx.member.findFirst({ where: { id, businessId } });
    if (!member)
      throw new NotFoundException('Member not found in this business');
    return member;
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
  private audit(
    tx: Prisma.TransactionClient,
    userId: string,
    member: Member,
    action: string,
  ) {
    return tx.auditEvent.create({
      data: {
        businessId: member.businessId,
        actorId: userId,
        targetId: member.id,
        action,
        metadata: {
          memberName: member.fullName,
          memberNumber: member.memberNumber,
        },
      },
    });
  }
  private async checkBranch(
    tx: Prisma.TransactionClient,
    businessId: string,
    branchId?: string | null,
  ) {
    if (
      branchId &&
      !(await tx.branch.findFirst({
        where: { id: branchId, businessId, status: 'ACTIVE' },
      }))
    )
      throw new BadRequestException(
        'Select an active branch in this business.',
      );
  }
  private async checkPhone(
    tx: Prisma.TransactionClient,
    businessId: string,
    phone: string,
    id?: string,
  ) {
    const existing = await tx.member.findFirst({
      where: {
        businessId,
        currentPhone: phone,
        ...(id ? { id: { not: id } } : {}),
      },
      select: { id: true },
    });
    if (existing)
      throw new ConflictException({
        code: 'DUPLICATE_MEMBER_PHONE',
        message:
          'A current member already uses this mobile number in this business. Search the member list to edit the existing profile.',
      });
  }
  private parsePhoto(value: string | null | undefined) {
    if (value === undefined || value === null) return value;
    const match =
      /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
        value,
      );
    if (!match)
      throw new BadRequestException(
        'Profile photo must be a JPEG, PNG or WebP image.',
      );
    const data = Buffer.from(match[2]!, 'base64');
    if (!data.length || data.length > 1572864)
      throw new BadRequestException(
        'Profile photo must be no larger than 1.5 MB.',
      );
    const type = match[1]!;
    const valid =
      (type === 'image/jpeg' &&
        data[0] === 0xff &&
        data[1] === 0xd8 &&
        data[2] === 0xff) ||
      (type === 'image/png' &&
        data
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (type === 'image/webp' &&
        data.subarray(0, 4).toString() === 'RIFF' &&
        data.subarray(8, 12).toString() === 'WEBP');
    if (!valid)
      throw new BadRequestException(
        'Profile photo content does not match its image type.',
      );
    return { contentType: type, data };
  }
  private async savePhoto(
    tx: Prisma.TransactionClient,
    businessId: string,
    memberId: string,
    value: string | null | undefined,
  ) {
    const photo = this.parsePhoto(value);
    if (photo === undefined) return;
    if (photo === null) {
      await tx.memberProfilePhoto.deleteMany({
        where: { businessId, memberId },
      });
      return;
    }
    await tx.memberProfilePhoto.upsert({
      where: { memberId },
      create: { businessId, memberId, ...photo },
      update: photo,
    });
  }
  async photoDataUrl(businessId: string, memberId: string) {
    const photo = await this.database.db.memberProfilePhoto.findFirst({
      where: { businessId, memberId },
    });
    return photo
      ? `data:${photo.contentType};base64,${Buffer.from(photo.data).toString('base64')}`
      : null;
  }
  private async dates(
    tx: Prisma.TransactionClient,
    businessId: string,
    input: UpdateMemberDto,
  ) {
    const business = await tx.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { timezone: true },
    });
    const parse = (value: string | null | undefined, field: string) => {
      if (value === undefined || value === null) return value;
      if (!isCalendarDate(value))
        throw new BadRequestException(
          `${field} must be a valid calendar date on or after 1900-01-01.`,
        );
      return new Date(`${value}T00:00:00.000Z`);
    };
    if (
      input.dateOfBirth &&
      input.dateOfBirth > calendarToday(business.timezone)
    )
      throw new BadRequestException('Date of birth cannot be in the future.');
    const joiningDate = parse(input.joiningDate, 'Joining date');
    if (joiningDate === null)
      throw new BadRequestException('Joining date is required.');
    return {
      joiningDate,
      dateOfBirth: parse(input.dateOfBirth, 'Date of birth'),
    };
  }
  async list(
    userId: string,
    businessId: string,
    query: ListMembersDto,
  ): Promise<MemberList> {
    await this.access(this.database.db, businessId, userId);
    if (
      query.branchId &&
      !(await this.database.db.branch.findFirst({
        where: { id: query.branchId, businessId },
      }))
    )
      throw new ForbiddenException('Branch does not belong to this business');
    const search = query.search;
    const phoneSearch = search ? normalizeMemberPhone(search) : '';
    const where: Prisma.MemberWhereInput = {
      businessId,
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.status === 'ALL' ? {} : { status: query.status }),
      ...(search
        ? {
            OR: [
              ...['fullName', 'memberNumber', 'email'].map((field) => ({
                [field]: { contains: search, mode: 'insensitive' },
              })),
              ...(phoneSearch ? [{ phone: { contains: phoneSearch } }] : []),
            ],
          }
        : {}),
    };
    const [total, items] = await this.database.db.$transaction(
      [
        this.database.db.member.count({ where }),
        this.database.db.member.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    const balances = items.length
      ? await this.database.db.$queryRaw<
          Array<{ memberId: string; outstanding: bigint; memberships: bigint }>
        >(
          Prisma.sql`${ledger(businessId)} SELECT "memberId",sum("outstandingMinor")::bigint AS outstanding,count(*)::bigint AS memberships FROM ledger WHERE "memberId" IN (${Prisma.join(items.map((m) => Prisma.sql`${m.id}::uuid`))}) ${query.branchId ? Prisma.sql`AND "branchId"=${query.branchId}::uuid` : Prisma.empty} GROUP BY "memberId"`,
        )
      : [];
    const byMember = new Map(balances.map((b) => [b.memberId, b]));
    return {
      items: items.map((m) => ({
        ...record(m),
        outstandingMinor: Number(byMember.get(m.id)?.outstanding || 0),
        membershipCount: Number(byMember.get(m.id)?.memberships || 0),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
  async get(
    userId: string,
    businessId: string,
    id: string,
  ): Promise<MemberDetail> {
    await this.access(this.database.db, businessId, userId);
    const member = await this.find(this.database.db, businessId, id);
    const business = await this.database.db.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { name: true, timezone: true },
    });
    const events = await this.database.db.auditEvent.findMany({
      where: {
        businessId,
        targetId: id,
        action: { in: ['MEMBER_CREATED', 'MEMBER_UPDATED', 'MEMBER_ARCHIVED'] },
      },
      select: { id: true, action: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });
    return {
      ...record(member),
      profilePhotoDataUrl: await this.photoDataUrl(businessId, id),
      business,
      activity: events.map((event) => ({
        id: event.id,
        action: event.action,
        occurredAt: event.createdAt.toISOString(),
      })),
    };
  }
  async create(userId: string, businessId: string, input: CreateMemberDto) {
    return this.write(businessId, userId, (tx) =>
      this.createInTransaction(tx, userId, businessId, input),
    );
  }
  /** Internal domain operation. Caller must authorize and hold the business row lock. */
  async createInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    businessId: string,
    input: CreateMemberDto,
  ) {
    const { profilePhotoDataUrl, emergencyContacts, ...profile } = input;
    await this.checkBranch(tx, businessId, input.branchId);
    await this.checkPhone(tx, businessId, input.phone);
    const dates = await this.dates(tx, businessId, input);
    const counter = await tx.memberCounter.upsert({
      where: { businessId },
      create: { businessId, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    const member = await tx.member.create({
      data: {
        ...profile,
        emergencyContacts: (emergencyContacts ||
          []) as unknown as Prisma.InputJsonValue,
        ...dates,
        joiningDate: dates.joiningDate!,
        businessId,
        currentPhone: input.phone,
        memberNumber: `MEM${String(counter.lastNumber).padStart(6, '0')}`,
      },
    });
    await this.savePhoto(tx, businessId, member.id, profilePhotoDataUrl);
    await this.audit(tx, userId, member, 'MEMBER_CREATED');
    return record(member);
  }
  async update(
    userId: string,
    businessId: string,
    id: string,
    input: UpdateMemberDto,
  ) {
    return this.write(businessId, userId, async (tx) => {
      const { profilePhotoDataUrl, emergencyContacts, ...profile } = input;
      const current = await this.find(tx, businessId, id);
      if (current.status === 'ARCHIVED')
        throw new ConflictException({
          code: 'MEMBER_ARCHIVED',
          message: 'Archived members are read-only.',
        });
      const dates = await this.dates(tx, businessId, input);
      if (input.branchId !== current.branchId)
        await this.checkBranch(tx, businessId, input.branchId);
      if (input.phone) await this.checkPhone(tx, businessId, input.phone, id);
      const member = await tx.member.update({
        where: { id },
        data: {
          ...profile,
          ...(emergencyContacts !== undefined
            ? {
                emergencyContacts:
                  emergencyContacts as unknown as Prisma.InputJsonValue,
              }
            : {}),
          ...dates,
          ...(input.phone ? { currentPhone: input.phone } : {}),
        },
      });
      await this.savePhoto(tx, businessId, member.id, profilePhotoDataUrl);
      await this.audit(tx, userId, member, 'MEMBER_UPDATED');
      return record(member);
    });
  }
  async archive(userId: string, businessId: string, id: string) {
    return this.write(businessId, userId, async (tx) => {
      const current = await this.find(tx, businessId, id);
      if (current.status === 'ARCHIVED') return record(current);
      const member = await tx.member.update({
        where: { id },
        data: {
          status: 'ARCHIVED',
          archivedAt: new Date(),
          currentPhone: null,
        },
      });
      await this.audit(tx, userId, member, 'MEMBER_ARCHIVED');
      return record(member);
    });
  }
}
