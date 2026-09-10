'use client';
import { Building2, CalendarDays, ChevronRight } from 'lucide-react';
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-36" />
          ))}
        </div>
        <Skeleton className="h-24" />
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
  const name = profile.data?.name.trim().split(/\s+/)[0];
  const date = new Intl.DateTimeFormat('en', {
    timeZone: data.business.timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(data.generatedAt));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-600">
            Your daily overview
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[27px]">
            Welcome back{name ? `, ${name}` : ''}
          </h1>
          <p className="mt-2 text-xs text-slate-500">
            Here&apos;s what&apos;s happening across your gym today.
          </p>
        </div>
        <span className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
          <CalendarDays size={14} aria-hidden="true" />
          {date}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          <span className="font-medium text-slate-700">
            {data.branchSummary.selected?.name || 'All Branches'}
          </span>
          <span className="mx-2 text-slate-300">/</span>
          {data.branchSummary.inScope}{' '}
          {data.branchSummary.inScope === 1 ? 'branch' : 'branches'} in view
        </p>
        <span className="text-[11px] text-slate-500">
          Operational records will appear as your gym grows
        </span>
      </div>
      <DashboardMetrics data={data} />
      <DashboardSections data={data} />
      <footer className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
          <span className="flex items-center gap-2 font-semibold text-slate-700">
            <Building2 size={15} aria-hidden="true" />
            {data.business.name}
          </span>
          <span className="capitalize">{data.role.toLowerCase()}</span>
          <span>{data.business.currency}</span>
          <span>{data.business.timezone}</span>
          <span>
            {data.branchSummary.total}{' '}
            {data.branchSummary.total === 1 ? 'branch' : 'branches'}
          </span>
        </div>
        {data.role === 'OWNER' && (
          <Link
            className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
            href={href('/admin/settings/access')}
          >
            Access management
            <ChevronRight size={13} aria-hidden="true" />
          </Link>
        )}
      </footer>
    </div>
  );
}
