'use client';
import { useState } from 'react';
import { formatMoneyMinor } from '@gym/validation';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { BranchDetail } from '@gym/types';
import { Card } from '@/components/ui/card';
import { useAdminContext } from '@/features/admin/admin-context';
import { useBranch } from './use-branches';
import { ArchiveBranchDialog } from './archive-branch-dialog';
import {
  BranchBack,
  BranchError,
  BranchHeader,
  BranchLoading,
  BranchStatusBadge,
  branchDate,
} from './branch-shared';

function BranchOverview({ branch }: { branch: BranchDetail }) {
  const money = (value: number) =>
    formatMoneyMinor(value, branch.business.currency);
  const metrics = [
    ['Members', branch.metrics.members],
    ['Active Memberships', branch.metrics.activeMemberships],
    ['Staff', branch.metrics.staff],
    ["Today's Check-ins", branch.metrics.todayCheckIns],
    ['Outstanding Dues', money(branch.metrics.outstandingDues)],
    ['Collections', money(branch.metrics.collections)],
  ];
  const address = [
    branch.addressLine1,
    branch.addressLine2,
    branch.city,
    branch.state,
    branch.postalCode,
    branch.country,
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(([label, value]) => (
          <Card key={label} className="p-5" aria-label={`${label}: ${value}`}>
            <h2 className="text-sm font-medium text-slate-500">{label}</h2>
            <p className="mt-3 text-2xl font-semibold">{value}</p>
          </Card>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Members are registered at this branch. Staff are active employees
        assigned here. Collections include valid payments this month; dues are
        current outstanding balances.
      </p>
      <Card className="p-6">
        <h2>Branch information</h2>
        <dl className="mt-5 grid gap-6 text-sm sm:grid-cols-2">
          {[
            ['Address', address || 'Address not added'],
            ['Phone', branch.phone || 'Not added'],
            ['Email', branch.email || 'Not added'],
            ['Business timezone', branch.business.timezone],
            [
              'Branch timezone',
              `${branch.effectiveTimezone}${branch.timezone ? ' (override)' : ' (inherited)'}`,
            ],
            ['Created', branchDate(branch.createdAt, branch.effectiveTimezone)],
            [
              'Last updated',
              branchDate(branch.updatedAt, branch.effectiveTimezone),
            ],
            ...(branch.archivedAt
              ? [
                  [
                    'Archived',
                    branchDate(branch.archivedAt, branch.effectiveTimezone),
                  ],
                ]
              : []),
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-slate-500">{label}</dt>
              <dd className="mt-1 break-words font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
const sections = [
  'Overview',
  'Members',
  'Staff',
  'Attendance',
  'Memberships',
  'Financials',
];
export function BranchDetailView({ id }: { id: string }) {
  const { current, href } = useAdminContext();
  const query = useBranch(id);
  const params = useSearchParams();
  const [section, setSection] = useState('Overview');
  if (query.isPending) return <BranchLoading />;
  if (query.error)
    return (
      <div className="space-y-4">
        <BranchBack href={href('/admin/branches')} />
        <BranchError error={query.error} retry={() => void query.refetch()} />
      </div>
    );
  const branch = query.data;
  return (
    <div className="space-y-6">
      <BranchBack href={href('/admin/branches')} />
      <BranchHeader
        title={branch.name}
        subtitle={`${branch.code} · ${branch.business.name}`}
      >
        {branch.status === 'ACTIVE' && (
          <>
            <Link className="button" href={href(`/admin/branches/${id}/edit`)}>
              Edit Branch
            </Link>
            {current?.role === 'OWNER' && (
              <ArchiveBranchDialog id={id} name={branch.name} />
            )}
          </>
        )}
      </BranchHeader>
      <BranchStatusBadge status={branch.status} />
      {['created', 'updated'].includes(params.get('notice') || '') &&
        branch.status === 'ACTIVE' && (
          <p
            role="status"
            className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
          >
            Branch {params.get('notice')} successfully.
          </p>
        )}
      {branch.status === 'ARCHIVED' && (
        <p
          role="status"
          className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900"
        >
          This branch is archived and read-only. Historical records are
          preserved.
        </p>
      )}
      <nav
        aria-label="Branch sections"
        className="flex flex-wrap gap-2 border-b border-slate-200 pb-3"
      >
        {sections.map((label) => (
          <button
            key={label}
            aria-pressed={section === label}
            onClick={() => setSection(label)}
            className={
              section === label
                ? 'bg-blue-50 text-blue-700'
                : 'bg-transparent text-slate-500 hover:bg-slate-100'
            }
          >
            {label}
          </button>
        ))}
      </nav>
      {section === 'Overview' ? (
        <BranchOverview branch={branch} />
      ) : (
        <Card className="space-y-2 p-8">
          <h2>{section}</h2>
          <p className="text-sm text-slate-500">
            View {section.toLowerCase()} for {branch.name}.
          </p>
          <Link
            className="button"
            href={`/admin/${({ Members: 'members', Staff: 'staff', Attendance: 'attendance', Memberships: 'memberships', Financials: 'dues' } as Record<string, string>)[section]}?businessId=${branch.businessId}&branchId=${branch.id}`}
          >
            Open {section.toLowerCase()}
          </Link>
        </Card>
      )}
    </div>
  );
}
