'use client';
import Link from 'next/link';
import type { DashboardResponse } from '@gym/types';
import { useAdminContext } from '@/features/admin/admin-context';
import { useBusinessQuery } from '@/features/product/data';
export function Notifications() {
  const { href, branchId } = useAdminContext();
  const query = useBusinessQuery<DashboardResponse>(
    'dashboard',
    branchId ? { branchId } : {},
  );
  if (query.isPending)
    return <p className="p-3 text-sm">Loading notifications...</p>;
  if (query.error)
    return (
      <div className="p-3 text-sm">
        <p>{query.error.message}</p>
        <button onClick={() => void query.refetch()}>Retry</button>
      </div>
    );
  return (
    <div className="max-h-80 w-72 space-y-3 overflow-y-auto p-3 text-sm">
      <h2 className="font-semibold">Gym reminders</h2>
      <p className="text-xs text-slate-500">
        Upcoming renewals and outstanding balances for the selected scope.
      </p>
      {!query.data.upcomingExpirations.length &&
        !query.data.outstandingDues.length && <p>No reminders right now.</p>}
      {query.data.upcomingExpirations.map((m) => (
        <Link
          key={`renew-${m.id}`}
          className="block rounded-lg bg-blue-50 p-3"
          href={href(`/admin/memberships/${m.id}`)}
        >
          {m.memberName}: {m.planName} expires {m.endDate}.
        </Link>
      ))}
      {query.data.outstandingDues.map((d) => (
        <Link
          key={`due-${d.id}`}
          className="block rounded-lg bg-amber-50 p-3"
          href={href(`/admin/memberships/${d.id}`)}
        >
          {d.memberName}: payment outstanding.
        </Link>
      ))}
    </div>
  );
}
