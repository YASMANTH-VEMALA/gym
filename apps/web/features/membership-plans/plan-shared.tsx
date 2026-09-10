import Link from 'next/link';
import type { ReactNode } from 'react';
import type { MembershipPlanRecord } from '@gym/types';
import { Card } from '@/components/ui/card';
export function PlanHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="break-words text-2xl">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </header>
  );
}
export function PlanStatusBadge({
  status,
}: {
  status: MembershipPlanRecord['status'];
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : status === 'INACTIVE' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}
    >
      {status[0] + status.slice(1).toLowerCase()}
    </span>
  );
}
export function PlanLoading() {
  return (
    <Card className="p-8" role="status" aria-label="Loading membership plans">
      Loading membership plans…
    </Card>
  );
}
export function PlanError({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return (
    <Card className="space-y-3 p-6">
      <h2>Unable to load membership plans</h2>
      <p role="alert" className="text-sm text-red-700">
        {error.message}
      </p>
      <button onClick={retry}>Retry</button>
    </Card>
  );
}
export function PlanBack({ href }: { href: string }) {
  return (
    <Link
      className="inline-block text-sm font-medium text-blue-700"
      href={href}
    >
      ← Back to plans
    </Link>
  );
}
export function planAvailability(plan: MembershipPlanRecord) {
  return plan.appliesToAllBranches
    ? 'All active branches'
    : plan.branches
        .map(
          (branch) =>
            branch.name + (branch.status === 'ARCHIVED' ? ' (archived)' : ''),
        )
        .join(', ');
}
export function planDate(value: string, timezone = 'UTC') {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeZone: timezone,
  }).format(new Date(value));
}
