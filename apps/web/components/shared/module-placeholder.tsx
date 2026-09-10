'use client';
import Link from 'next/link';
import {
  ArrowLeft,
  PanelsTopLeft,
  Settings2,
  ArrowUpRight,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useAdminContext } from '@/features/admin/admin-context';
export function ModulePlaceholder({ title }: { title: string }) {
  const { current, href } = useAdminContext();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your gym, organized in one place.
        </p>
      </div>
      <Card className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
        <PanelsTopLeft
          className="mb-4 text-slate-300"
          size={32}
          aria-hidden="true"
        />
        <h2 className="text-base">{title} is coming soon</h2>
        <p className="mt-2 max-w-md text-sm text-slate-500">
          This part of your workspace will be available in a later phase.
        </p>
        <Link
          href={href('/admin/dashboard')}
          className="mt-6 flex items-center gap-2 text-sm font-medium text-blue-700"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to dashboard
        </Link>
      </Card>
      {title === 'Settings' && current?.role === 'OWNER' && (
        <Link
          href={href('/admin/settings/access')}
          className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-200"
        >
          <Settings2 size={20} className="text-blue-600" aria-hidden="true" />
          <div className="flex-1">
            <h2 className="text-sm">Access management</h2>
            <p className="mt-1 text-xs text-slate-500">
              Manage your existing Admin invitations.
            </p>
          </div>
          <ArrowUpRight
            size={18}
            className="text-slate-400"
            aria-hidden="true"
          />
        </Link>
      )}
    </div>
  );
}
