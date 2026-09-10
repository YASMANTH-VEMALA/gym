import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import type { MemberStatus } from '@gym/types';
import { calendarToday } from '@gym/validation';
import { Card } from '@/components/ui/card';
export function MemberAvatar({
  name,
  photoDataUrl,
}: {
  name: string;
  photoDataUrl?: string | null;
}) {
  if (photoDataUrl)
    return (
      <Image
        alt={`${name} profile photo`}
        className="size-12 shrink-0 rounded-full object-cover"
        height={48}
        src={photoDataUrl}
        unoptimized
        width={48}
      />
    );
  return (
    <span
      aria-label="Member avatar placeholder"
      className="flex size-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-lg font-semibold text-blue-700"
    >
      {name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase() || '?'}
    </span>
  );
}
export function MemberHeader({
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
export function MemberStatusBadge({ status }: { status: MemberStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : status === 'INACTIVE' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}
    >
      {status[0] + status.slice(1).toLowerCase()}
    </span>
  );
}
export function MemberLoading() {
  return (
    <Card role="status" aria-label="Loading members" className="p-8">
      Loading members…
    </Card>
  );
}
export function MemberError({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return (
    <Card className="space-y-3 p-6">
      <h2>Unable to load members</h2>
      <p role="alert" className="text-sm text-red-700">
        {error.message}
      </p>
      <button onClick={retry}>Retry</button>
    </Card>
  );
}
export function MemberBack({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-block text-sm font-medium text-blue-700"
    >
      ← Back to members
    </Link>
  );
}
export function memberDate(value: string, timezone = 'UTC') {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeZone: value.length === 10 ? 'UTC' : timezone,
  }).format(new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value));
}
export function memberAge(dateOfBirth: string, timezone: string) {
  const today = calendarToday(timezone);
  return Math.max(
    0,
    Number(today.slice(0, 4)) -
      Number(dateOfBirth.slice(0, 4)) -
      (today.slice(5) < dateOfBirth.slice(5) ? 1 : 0),
  );
}
