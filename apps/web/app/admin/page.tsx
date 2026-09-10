import { redirect } from 'next/navigation';
export default async function AdminRoot({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ['businessId', 'branchId'])
    if (typeof params[key] === 'string') query.set(key, params[key]);
  redirect(`/admin/dashboard${query.size ? `?${query}` : ''}`);
}
