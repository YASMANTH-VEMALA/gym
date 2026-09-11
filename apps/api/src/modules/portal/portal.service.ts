import {
  Injectable,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { calendarToday } from '@gym/validation';
import { BusinessScope, wire } from '../../common/business-scope';
import { Prisma } from '../../generated/prisma/client';
import { AuthService, type Identity } from '../auth/auth.service';
import { MembersService } from '../members/members.service';
import { QrService } from '../qr/qr.service';
import { ledger } from '../finance/ledger';
import { RegisterMemberDto, MemberPageQuery } from './portal.dto';
const profileSelect = {
  id: true,
  businessId: true,
  fullName: true,
  memberNumber: true,
  phone: true,
  alternatePhone: true,
  email: true,
  gender: true,
  dateOfBirth: true,
  joiningDate: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  state: true,
  postalCode: true,
  country: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
  emergencyContacts: true,
  heightCm: true,
  weightGrams: true,
  fitnessGoal: true,
  status: true,
} as const;
@Injectable()
export class PortalService {
  constructor(
    readonly scope: BusinessScope,
    private readonly auth: AuthService,
    private readonly members: MembersService,
    private readonly qr: QrService,
  ) {}
  async onlyMemberAccount(tx: Prisma.TransactionClient, userId: string) {
    if (await tx.businessAccess.findFirst({ where: { userId } }))
      throw new ForbiddenException(
        'Use a separate member account. This account has Owner or Admin access.',
      );
  }
  links(userId: string) {
    return this.scope.database.db.memberAccountLink.findMany({
      where: { userId },
      select: {
        memberId: true,
        businessId: true,
        member: {
          select: { fullName: true, memberNumber: true, status: true },
        },
        business: { select: { name: true, currency: true, timezone: true, logoUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
  async access(userId: string, memberId: string) {
    const link = await this.scope.database.db.memberAccountLink.findFirst({
      where: { userId, memberId },
      include: { business: true },
    });
    if (!link)
      throw new ForbiddenException(
        'This member profile is not linked to your account',
      );
    return link;
  }
  async register(identity: Identity, input: RegisterMemberDto) {
    const email = await this.auth.verifiedEmail(identity);
    const candidate = await this.qr.branchToken(input.token);
    return this.scope.database.db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${identity.userId}))`;
        await this.onlyMemberAccount(tx, identity.userId);
        await tx.$queryRaw`SELECT id FROM "Business" WHERE id=${candidate.businessId}::uuid FOR UPDATE`;
        const qr = await this.qr.branchToken(input.token, tx);
        const existing = await tx.memberAccountLink.findUnique({
          where: {
            businessId_userId: {
              businessId: qr.businessId,
              userId: identity.userId,
            },
          },
        });
        if (existing) return { memberId: existing.memberId };
        if (
          await tx.member.findFirst({
            where: { businessId: qr.businessId, currentPhone: input.phone },
          })
        )
          throw new ConflictException(
            'This mobile number already belongs to a member. Ask your gym to email a secure profile-link invitation.',
          );
        const { token, ...profile } = input;
        void token;
        const member = await this.members.createInTransaction(
          tx,
          identity.userId,
          qr.businessId,
          {
            ...profile,
            branchId: qr.branchId,
            email,
            joiningDate: calendarToday(
              qr.branch!.timezone || qr.business.timezone,
            ),
          },
        );
        const link = await tx.memberAccountLink.create({
          data: {
            businessId: qr.businessId,
            memberId: member.id,
            userId: identity.userId,
          },
        });
        await tx.auditEvent.create({
          data: {
            businessId: qr.businessId,
            actorId: identity.userId,
            targetId: member.id,
            action: 'MEMBER_QR_REGISTERED',
            metadata: { sourceBranchId: qr.branchId },
          },
        });
        await this.scope.audit(
          tx,
          qr.businessId,
          identity.userId,
          link.id,
          'MEMBER_ACCOUNT_LINKED',
        );
        return { memberId: member.id };
      },
      { timeout: 15000 },
    );
  }
  async profile(userId: string, memberId: string) {
    const link = await this.access(userId, memberId);
    const member = await this.scope.database.db.member.findUniqueOrThrow({
      where: { id: memberId },
      select: profileSelect,
    });
    const [summary] = await this.scope.database.db.$queryRaw<
      Array<Record<string, bigint>>
    >(
      Prisma.sql`${ledger(link.businessId)} SELECT COALESCE(sum("outstandingMinor"),0)::bigint AS "outstandingMinor",COALESCE(sum("paidMinor"),0)::bigint AS "paidMinor",count(*)::bigint AS memberships FROM ledger WHERE "memberId"=${memberId}::uuid`,
    );
    const today = new Date(
      `${calendarToday(link.business.timezone)}T00:00:00Z`,
    );
    const current = await this.scope.database.db.membership.findMany({
      where: {
        businessId: link.businessId,
        memberId,
        cancelledAt: null,
        startDate: { lte: today },
        endDate: { gte: today },
      },
      select: {
        id: true,
        planNameSnapshot: true,
        startDate: true,
        endDate: true,
        branch: { select: { name: true } },
        priceMinorSnapshot: true,
      },
      orderBy: { endDate: 'asc' },
      take: 100,
    });
    return wire({
      member: {
        ...member,
        profilePhotoDataUrl: await this.members.photoDataUrl(
          link.businessId,
          memberId,
        ),
      },
      business: {
        name: link.business.name,
        currency: link.business.currency,
        timezone: link.business.timezone,
      },
      summary,
      currentMemberships: current,
    });
  }
  async memberships(userId: string, memberId: string, q: MemberPageQuery) {
    const link = await this.access(userId, memberId),
      today = calendarToday(link.business.timezone),
      where = { businessId: link.businessId, memberId };
    const [total, items] = await this.scope.database.db.$transaction([
      this.scope.database.db.membership.count({ where }),
      this.scope.database.db.membership.findMany({
        where,
        select: {
          id: true,
          planNameSnapshot: true,
          priceMinorSnapshot: true,
          durationDaysSnapshot: true,
          startDate: true,
          endDate: true,
          cancelledAt: true,
          branch: { select: { name: true } },
        },
        orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
        take: q.pageSize,
        skip: (q.page - 1) * q.pageSize,
      }),
    ]);
    return wire({
      total,
      page: q.page,
      pageSize: q.pageSize,
      items: items.map((m) => ({
        ...m,
        status: m.cancelledAt
          ? 'CANCELLED'
          : m.startDate.toISOString().slice(0, 10) > today
            ? 'UPCOMING'
            : m.endDate.toISOString().slice(0, 10) < today
              ? 'EXPIRED'
              : 'ACTIVE',
      })),
    });
  }
  async dues(userId: string, memberId: string, q: MemberPageQuery) {
    const link = await this.access(userId, memberId);
    const base = ledger(link.businessId);
    const [items, counts] = await this.scope.database.db.$transaction([
      this.scope.database.db.$queryRaw(
        Prisma.sql`${base} SELECT id,"membershipId","planNameSnapshot","branchName","originalAmountMinor","paidMinor","outstandingMinor","dueDate","promiseToPayDate",status FROM ledger WHERE "memberId"=${memberId}::uuid ORDER BY "dueDate" DESC,id LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`,
      ),
      this.scope.database.db.$queryRaw<Array<{ total: number }>>(
        Prisma.sql`${base} SELECT count(*)::int AS total FROM ledger WHERE "memberId"=${memberId}::uuid`,
      ),
    ]);
    return wire({
      items,
      total: counts[0]!.total,
      page: q.page,
      pageSize: q.pageSize,
    });
  }
  async payments(userId: string, memberId: string, q: MemberPageQuery) {
    const link = await this.access(userId, memberId),
      where = {
        businessId: link.businessId,
        receivable: { membership: { memberId } },
      };
    const [total, items] = await this.scope.database.db.$transaction([
      this.scope.database.db.payment.count({ where }),
      this.scope.database.db.payment.findMany({
        where,
        select: {
          id: true,
          amountMinor: true,
          method: true,
          reference: true,
          paidAt: true,
          status: true,
          receivable: {
            select: {
              membership: {
                select: {
                  planNameSnapshot: true,
                  branch: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: [{ paidAt: 'desc' }, { id: 'asc' }],
        take: q.pageSize,
        skip: (q.page - 1) * q.pageSize,
      }),
    ]);
    return wire({ total, items, page: q.page, pageSize: q.pageSize });
  }
  async card(userId: string, memberId: string, requestOrigin?: string) {
    const link = await this.access(userId, memberId);
    const credential = await this.scope.database.db.qrCredential.findFirst({
      where: {
        businessId: link.businessId,
        memberId,
        kind: 'MEMBER',
        status: 'ACTIVE',
        member: { status: 'ACTIVE' },
      },
    });
    return credential ? this.qr.image(credential, requestOrigin) : null;
  }
}
