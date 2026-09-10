import Link from 'next/link';
import type { ReactNode } from 'react';
import type { StaffRecord } from '@gym/types';
import { Card } from '@/components/ui/card';
export function StaffHeader({
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
export function StaffStatusBadge({
  status,
}: {
  status: StaffRecord['status'];
}) {
  const style =
    status === 'ACTIVE'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'INACTIVE'
        ? 'bg-amber-50 text-amber-800'
        : 'bg-slate-100 text-slate-600';
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${style}`}
    >
      {status[0] + status.slice(1).toLowerCase()}
    </span>
  );
}
export function StaffLoading() {
  return (
    <Card className="p-8" role="status" aria-label="Loading staff">
      Loading staff information…
    </Card>
  );
}
export function StaffError({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return (
    <Card className="space-y-3 p-6">
      <h2>Unable to load staff</h2>
      <p role="alert" className="text-sm text-red-700">
        {error.message}
      </p>
      <button onClick={retry}>Retry</button>
    </Card>
  );
}
export function StaffBack({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-block text-sm font-medium text-blue-700"
    >
      ← Back to staff
    </Link>
  );
}
export const displayDate = (value: string, timezone = 'UTC') =>
  new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeZone: timezone,
  }).format(new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value));
