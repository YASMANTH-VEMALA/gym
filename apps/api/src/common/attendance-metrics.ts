import { Prisma } from '../generated/prisma/client';
export async function todayCheckIns(
  db: Prisma.TransactionClient,
  businessId: string,
  branchId?: string,
) {
  const [row] = await db.$queryRaw<Array<{ count: number }>>(
    Prisma.sql`SELECT count(*)::int AS count FROM "Attendance" a JOIN "Branch" br ON br.id=a."branchId" JOIN "Business" b ON b.id=a."businessId" WHERE a."businessId"=${businessId}::uuid AND a."attendanceDate"=(CURRENT_TIMESTAMP AT TIME ZONE COALESCE(br.timezone,b.timezone))::date ${branchId ? Prisma.sql`AND a."branchId"=${branchId}::uuid` : Prisma.empty}`,
  );
  return row?.count || 0;
}
