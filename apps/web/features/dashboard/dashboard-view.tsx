'use client';
import {
  CalendarDays,
  Wallet,
  UserPlus,
  ScanLine,
} from 'lucide-react';
import Link from 'next/link';
import { useAdminContext } from '@/features/admin/admin-context';
import { useAccountProfile } from '@/features/admin/use-business-access';
import { QueryError } from '@/components/shared/query-error';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboard } from './use-dashboard';
import { DashboardMetrics } from './dashboard-metrics';
import { DashboardSections } from './dashboard-sections';

export function DashboardView() {
  const query = useDashboard();
  const profile = useAccountProfile();
  const { href } = useAdminContext();

  if (query.isPending)
    return (
      <div role="status" aria-label="Loading dashboard" className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-20" />
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );

  if (query.error || !query.data)
    return (
      <QueryError
        title="Unable to load dashboard"
        message={query.error?.message || 'Please try again.'}
        retry={() => {
          void query.refetch();
        }}
      />
    );

  const data = query.data;
  const name = profile.data?.name?.trim().split(/\s+/)[0];
  const date = new Intl.DateTimeFormat('en', {
    timeZone: data.business.timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(data.generatedAt));

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-[28px]">
            Welcome back{name ? `, ${name}` : ''}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Here&apos;s what&apos;s happening at your gym today.
          </p>
        </div>
        <time className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <CalendarDays size={15} aria-hidden="true" />
          {date}
        </time>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-7">
        <Link
          href={href('/admin/attendance?tab=scanner')}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3.5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
        >
          <ScanLine size={15} aria-hidden="true" />
          Check in member
        </Link>
        <Link
          href={href('/admin/payments')}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
        >
          <Wallet size={15} aria-hidden="true" />
          Record payment
        </Link>
        <Link
          href={href('/admin/members')}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
        >
          <UserPlus size={15} aria-hidden="true" />
          Add member
        </Link>
      </div>

      <DashboardMetrics data={data} />
      <DashboardSections data={data} />
    </div>
  );
}
