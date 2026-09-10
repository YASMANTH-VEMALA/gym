import { Prisma } from '../../generated/prisma/client';
// Shared SQL projection: financial balances are derived, never cached or trusted from clients.
export function ledger(businessId: string) {
  return Prisma.sql`WITH amounts AS (
 SELECT r.*, m."memberId",m."branchId",m."planId",m."planNameSnapshot",m."startDate",m."endDate",m."cancelledAt",n."fullName",n."memberNumber",br.name AS "branchName",b.currency,b.timezone,
 COALESCE((SELECT sum(p."amountMinor") FROM "Payment" p WHERE p."receivableId"=r.id AND p.status='RECORDED'),0)::bigint AS "paidMinor",
 (CURRENT_TIMESTAMP AT TIME ZONE b.timezone)::date AS today
 FROM "Receivable" r JOIN "Membership" m ON m.id=r."membershipId" AND m."businessId"=r."businessId" JOIN "Member" n ON n.id=m."memberId" JOIN "Branch" br ON br.id=m."branchId" JOIN "Business" b ON b.id=r."businessId" WHERE r."businessId"=${businessId}::uuid
), balances AS (SELECT *,CASE WHEN "voidedAt" IS NOT NULL THEN 0 ELSE "originalAmountMinor"-"paidMinor" END::bigint AS "outstandingMinor",COALESCE("promiseToPayDate","dueDate") AS "expectedDate" FROM amounts), ledger AS (
 SELECT *,CASE WHEN "voidedAt" IS NOT NULL THEN 'VOID' WHEN "outstandingMinor"=0 THEN 'PAID' WHEN today>"expectedDate" THEN 'OVERDUE' WHEN "paidMinor">0 THEN 'PARTIALLY_PAID' ELSE 'OPEN' END AS status FROM balances
)`;
}
