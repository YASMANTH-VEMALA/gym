import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { calendarToday } from '@gym/validation';
import { BusinessScope, dateOnly, wire } from '../../common/business-scope';
import { Prisma } from '../../generated/prisma/client';
import { FinanceQuery, RecordPaymentDto } from './finance.dto';
import { ledger } from './ledger';
@Injectable()
export class FinanceService {
  constructor(readonly scope: BusinessScope) {}
  async filters(userId: string, businessId: string, q: FinanceQuery) {
    await this.scope.access(userId, businessId);
    await this.scope.branch(businessId, q.branchId);
    if (
      q.memberId &&
      !(await this.scope.database.db.member.findFirst({
        where: { id: q.memberId, businessId },
      }))
    )
      throw new NotFoundException('Related record not found in this business');
    if (
      q.membershipId &&
      !(await this.scope.database.db.membership.findFirst({
        where: { id: q.membershipId, businessId },
      }))
    )
      throw new NotFoundException('Related record not found in this business');
    for (const date of [q.dueFrom, q.dueTo, q.promiseDate])
      if (date) dateOnly(date);
    if (q.dueFrom && q.dueTo && q.dueFrom > q.dueTo)
      throw new BadRequestException('Due date range is reversed');
    const parts = [Prisma.sql`TRUE`];
    if (q.branchId) parts.push(Prisma.sql`"branchId"=${q.branchId}::uuid`);
    if (q.memberId) parts.push(Prisma.sql`"memberId"=${q.memberId}::uuid`);
    if (q.membershipId)
      parts.push(Prisma.sql`"membershipId"=${q.membershipId}::uuid`);
    if (q.status === 'OUTSTANDING')
      parts.push(Prisma.sql`"outstandingMinor">0`);
    else if (q.status !== 'ALL') parts.push(Prisma.sql`status=${q.status}`);
    if (q.search)
      parts.push(
        Prisma.sql`("fullName" ILIKE ${'%' + q.search + '%'} OR "memberNumber" ILIKE ${'%' + q.search + '%'})`,
      );
    if (q.dueFrom) parts.push(Prisma.sql`"dueDate">=${dateOnly(q.dueFrom)}`);
    if (q.dueTo) parts.push(Prisma.sql`"dueDate"<=${dateOnly(q.dueTo)}`);
    if (q.promiseDate)
      parts.push(Prisma.sql`"promiseToPayDate"=${dateOnly(q.promiseDate)}`);
    return Prisma.join(parts, ' AND ');
  }
  async dues(userId: string, businessId: string, q: FinanceQuery) {
    const where = await this.filters(userId, businessId, q);
    const base = ledger(businessId);
    const [items, summary] = await this.scope.database.db.$transaction(
      [
        this.scope.database.db.$queryRaw(
          Prisma.sql`${base} SELECT * FROM ledger WHERE ${where} ORDER BY "expectedDate",id LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`,
        ),
        this.scope.database.db.$queryRaw<Array<Record<string, bigint>>>(
          Prisma.sql`${base} SELECT count(*)::bigint AS total,COALESCE(sum("outstandingMinor"),0)::bigint AS "outstandingMinor",COALESCE(sum("outstandingMinor") FILTER(WHERE status='OVERDUE'),0)::bigint AS "overdueMinor",COALESCE(sum("outstandingMinor") FILTER(WHERE "expectedDate"=today),0)::bigint AS "dueTodayMinor",COALESCE(sum("outstandingMinor") FILTER(WHERE "promiseToPayDate">=date_trunc('week',today) AND "promiseToPayDate"<date_trunc('week',today)+interval '7 days'),0)::bigint AS "promisedWeekMinor",count(DISTINCT "memberId") FILTER(WHERE "outstandingMinor">0)::bigint AS "membersWithDues" FROM ledger WHERE ${where}`,
        ),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    const metrics = wire(summary[0]!);
    return {
      items: wire(items),
      total: metrics.total,
      page: q.page,
      pageSize: q.pageSize,
      metrics,
    };
  }
  async payments(userId: string, businessId: string, q: FinanceQuery) {
    await this.filters(userId, businessId, { ...q, status: 'ALL' });
    for (const date of [q.paidFrom, q.paidTo]) if (date) dateOnly(date);
    if (q.paidFrom && q.paidTo && q.paidFrom > q.paidTo)
      throw new BadRequestException('Payment date range is reversed');
    const where: Prisma.PaymentWhereInput = {
      businessId,
      ...(q.paymentMethod !== 'ALL'
        ? { method: q.paymentMethod as Prisma.EnumPaymentMethodFilter }
        : {}),
      ...((q.paidFrom || q.paidTo) && {
        paidAt: {
          ...(q.paidFrom ? { gte: dateOnly(q.paidFrom) } : {}),
          ...(q.paidTo ? { lte: dateOnly(q.paidTo) } : {}),
        },
      }),
      receivable: {
        membership: {
          memberId: q.memberId,
          branchId: q.branchId,
          id: q.membershipId,
        },
      },
    };
    const recordedWhere: Prisma.PaymentWhereInput = {
      ...where,
      status: 'RECORDED',
    };
    const [total, items, summary, branchRows] =
      await this.scope.database.db.$transaction([
        this.scope.database.db.payment.count({ where }),
        this.scope.database.db.payment.findMany({
          where,
          include: {
            receivable: {
              include: {
                membership: {
                  include: {
                    member: { select: { fullName: true, memberNumber: true } },
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
        this.scope.database.db.payment.aggregate({
          where: recordedWhere,
          _count: { _all: true },
          _sum: { amountMinor: true },
        }),
        this.scope.database.db.$queryRaw<
          Array<{
            branchId: string;
            branchName: string;
            paymentCount: bigint;
            collectedMinor: bigint;
          }>
        >(Prisma.sql`
        SELECT br.id AS "branchId", br.name AS "branchName",
          count(p.id)::bigint AS "paymentCount",
          COALESCE(sum(p."amountMinor"), 0)::bigint AS "collectedMinor"
        FROM "Branch" br
        LEFT JOIN "Membership" m ON m."branchId" = br.id AND m."businessId" = br."businessId"
          ${q.memberId ? Prisma.sql`AND m."memberId" = ${q.memberId}::uuid` : Prisma.empty}
          ${q.membershipId ? Prisma.sql`AND m.id = ${q.membershipId}::uuid` : Prisma.empty}
        LEFT JOIN "Receivable" r ON r."membershipId" = m.id AND r."businessId" = m."businessId"
        LEFT JOIN "Payment" p ON p."receivableId" = r.id
          AND p."businessId" = br."businessId"
          AND p.status = 'RECORDED'
          ${q.paidFrom ? Prisma.sql`AND p."paidAt" >= ${dateOnly(q.paidFrom)}` : Prisma.empty}
          ${q.paidTo ? Prisma.sql`AND p."paidAt" <= ${dateOnly(q.paidTo)}` : Prisma.empty}
          ${q.paymentMethod !== 'ALL' ? Prisma.sql`AND p.method::text = ${q.paymentMethod}` : Prisma.empty}
        WHERE br."businessId" = ${businessId}::uuid
          ${q.branchId ? Prisma.sql`AND br.id = ${q.branchId}::uuid` : Prisma.empty}
        GROUP BY br.id, br.name
        ORDER BY br.name
      `),
      ]);
    return {
      total,
      items: wire(items),
      page: q.page,
      pageSize: q.pageSize,
      metrics: {
        paymentCount: summary._count._all,
        collectedMinor: summary._sum.amountMinor || 0,
      },
      branches: wire(branchRows),
    };
  }
  record(userId: string, businessId: string, input: RecordPaymentDto) {
    return this.scope.write(userId, businessId, async (tx) => {
      const prior = await tx.payment.findUnique({
        where: {
          businessId_idempotencyKey: {
            businessId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (prior) {
        if (
          prior.receivableId !== input.receivableId ||
          prior.amountMinor !== input.amountMinor ||
          prior.method !== input.method ||
          prior.paidAt.toISOString().slice(0, 10) !== input.paidAt ||
          (prior.reference || null) !== (input.reference || null) ||
          (prior.notes || null) !== (input.notes || null)
        )
          throw new ConflictException(
            'Idempotency key was already used with different payment details',
          );
        return wire(prior);
      }
      const receivable = await tx.receivable.findFirst({
        where: { id: input.receivableId, businessId },
      });
      if (!receivable)
        throw new NotFoundException('Receivable not found in this business');
      if (receivable.voidedAt)
        throw new ConflictException('This obligation is void');
      const business = await tx.business.findUniqueOrThrow({
        where: { id: businessId },
      });
      if (input.paidAt > calendarToday(business.timezone))
        throw new BadRequestException('Payment date cannot be in the future');
      const paid =
        (
          await tx.payment.aggregate({
            where: { receivableId: receivable.id, status: 'RECORDED' },
            _sum: { amountMinor: true },
          })
        )._sum.amountMinor || 0;
      if (input.amountMinor > receivable.originalAmountMinor - paid)
        throw new ConflictException('Payment exceeds the outstanding balance');
      const payment = await tx.payment.create({
        data: {
          ...input,
          businessId,
          paidAt: dateOnly(input.paidAt),
          recordedByUserId: userId,
        },
      });
      await this.scope.audit(
        tx,
        businessId,
        userId,
        payment.id,
        'PAYMENT_RECORDED',
      );
      return wire(payment);
    });
  }
  voidPayment(userId: string, businessId: string, id: string, reason: string) {
    return this.scope.write(userId, businessId, async (tx) => {
      const item = await tx.payment.findFirst({ where: { id, businessId } });
      if (!item)
        throw new NotFoundException('Payment not found in this business');
      if (item.status === 'VOID') return wire(item);
      const changed = await tx.payment.update({
        where: { id },
        data: { status: 'VOID', voidedAt: new Date(), voidReason: reason },
      });
      await this.scope.audit(tx, businessId, userId, id, 'PAYMENT_VOIDED');
      return wire(changed);
    });
  }
  promise(userId: string, businessId: string, id: string, date: string | null) {
    if (date === undefined)
      throw new BadRequestException(
        'Provide a promise date or null to clear it',
      );
    return this.scope.write(userId, businessId, async (tx) => {
      const item = await tx.receivable.findFirst({ where: { id, businessId } });
      if (!item)
        throw new NotFoundException('Receivable not found in this business');
      if (item.voidedAt) throw new ConflictException('This obligation is void');
      const paid =
        (
          await tx.payment.aggregate({
            where: { receivableId: id, status: 'RECORDED' },
            _sum: { amountMinor: true },
          })
        )._sum.amountMinor || 0;
      if (paid >= item.originalAmountMinor)
        throw new ConflictException('This obligation has already been paid');
      const result = await tx.receivable.update({
        where: { id },
        data: { promiseToPayDate: date ? dateOnly(date) : null },
      });
      await this.scope.audit(
        tx,
        businessId,
        userId,
        id,
        item.promiseToPayDate ? 'PROMISE_TO_PAY_UPDATED' : 'PROMISE_TO_PAY_SET',
      );
      return wire(result);
    });
  }
}
