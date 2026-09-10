'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { useAdminContext } from '@/features/admin/admin-context';
import { useStaffMember } from './use-staff';
import { ArchiveStaffDialog } from './archive-staff-dialog';
import {
  StaffBack,
  StaffError,
  StaffHeader,
  StaffLoading,
  StaffStatusBadge,
  displayDate,
} from './staff-shared';
const sections = ['Overview', 'Branch assignments', 'Activity'];
export function StaffDetailView({ id }: { id: string }) {
  const { href } = useAdminContext();
  const query = useStaffMember(id);
  const params = useSearchParams();
  const [section, setSection] = useState('Overview');
  if (query.isPending) return <StaffLoading />;
  if (query.error)
    return (
      <div className="space-y-4">
        <StaffBack href={href('/admin/staff')} />
        <StaffError error={query.error} retry={() => void query.refetch()} />
      </div>
    );
  const staff = query.data;
  const details = [
    ['Phone', staff.phone],
    ['Email', staff.email || 'Not added'],
    ['Joining date', displayDate(staff.joiningDate)],
    [
      'Branches',
      staff.branches
        .map(
          (branch) =>
            `${branch.name}${branch.status === 'ARCHIVED' ? ' (archived)' : ''}`,
        )
        .join(', '),
    ],
    ['Gender', staff.gender || 'Not added'],
    [
      'Date of birth',
      staff.dateOfBirth ? displayDate(staff.dateOfBirth) : 'Not added',
    ],
    ['Address', staff.address || 'Not added'],
    [
      'Emergency contact',
      [staff.emergencyContactName, staff.emergencyContactPhone]
        .filter(Boolean)
        .join(' · ') || 'Not added',
    ],
    ['Created', displayDate(staff.createdAt, staff.business.timezone)],
  ];
  return (
    <div className="space-y-6">
      <StaffBack href={href('/admin/staff')} />
      <StaffHeader
        title={staff.fullName}
        subtitle={`${staff.jobTitle} · ${staff.business.name}`}
      >
        {staff.status !== 'ARCHIVED' && (
          <>
            <Link className="button" href={href(`/admin/staff/${id}/edit`)}>
              Edit Staff
            </Link>
            <ArchiveStaffDialog id={id} name={staff.fullName} />
          </>
        )}
      </StaffHeader>
      <StaffStatusBadge status={staff.status} />
      {['created', 'updated'].includes(params.get('notice') || '') &&
        staff.status !== 'ARCHIVED' && (
          <p
            role="status"
            className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
          >
            Staff {params.get('notice')} successfully.
          </p>
        )}
      {staff.status === 'ARCHIVED' && (
        <p
          role="status"
          className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900"
        >
          This staff record is archived and read-only. Historical assignments
          are preserved.
        </p>
      )}
      <nav
        aria-label="Staff sections"
        className="flex flex-wrap gap-2 border-b pb-3"
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
        <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
          <Card className="p-6">
            <h2>Staff information</h2>
            <dl className="mt-5 grid gap-6 text-sm sm:grid-cols-2">
              {details.map(([label, value]) => (
                <div className="min-w-0" key={label}>
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="mt-1 break-words font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card className="p-6">
            <h2>Notes</h2>
            <p className="mt-4 whitespace-pre-wrap break-words text-sm text-slate-600">
              {staff.notes || 'No notes added.'}
            </p>
          </Card>
        </div>
      ) : (
        <Card className="space-y-2 p-8">
          <h2>{section}</h2>
          {section === 'Activity' ? (
            <ul className="space-y-3">
              {staff.activity.map((e) => (
                <li key={e.id} className="flex justify-between gap-3 text-sm">
                  <span>
                    {e.action
                      .replace('STAFF_', 'Staff ')
                      .toLowerCase()
                      .replaceAll('_', ' ')}
                  </span>
                  <time>
                    {displayDate(e.occurredAt, staff.business.timezone)}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-3">
              {staff.branches.map((b) => (
                <li key={b.id}>
                  <Link
                    className="text-blue-700"
                    href={href(`/admin/branches/${b.id}`)}
                  >
                    {b.name}
                  </Link>{' '}
                  ? {b.status.toLowerCase()}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
