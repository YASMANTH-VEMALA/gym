'use client';
import { MemberInvitationPanel } from '@/features/portal/member-invitation-panel';
import { FinancePanel } from '@/features/finance/finance-panel';
import { useState } from 'react';
import { MembershipList } from '@/features/memberships/membership-pages';
import Link from 'next/link';
import { AttendancePage } from '@/features/attendance/attendance-page';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { useAdminContext } from '@/features/admin/admin-context';
import { useMember } from './use-members';
import {
  MemberAvatar,
  MemberBack,
  MemberError,
  MemberHeader,
  MemberLoading,
  MemberStatusBadge,
  memberDate,
} from './member-shared';
import { ArchiveMemberDialog } from './archive-member-dialog';
import { MemberOverview } from './member-overview';
const activityLabels: Record<string, string> = {
  MEMBER_CREATED: 'Member created',
  MEMBER_UPDATED: 'Member updated',
  MEMBER_ARCHIVED: 'Member archived',
};
export function MemberDetailView({ id }: { id: string }) {
  const { href, current } = useAdminContext();
  const query = useMember(id);
  const params = useSearchParams();
  const [tab, setTab] = useState('Overview');
  if (query.isPending) return <MemberLoading />;
  if (query.error)
    return (
      <div className="space-y-4">
        <MemberBack href={href('/admin/members')} />
        <MemberError error={query.error} retry={() => void query.refetch()} />
      </div>
    );
  const member = query.data;
  const empty: Record<string, string> = {
    Memberships: 'No memberships yet.',
    Payments: 'Payment history will appear after a membership is assigned.',
    Attendance: 'No attendance records yet.',
  };
  return (
    <div className="space-y-6">
      <MemberBack href={href('/admin/members')} />
      <div className="flex items-center gap-4">
        <MemberAvatar
          name={member.fullName}
          photoDataUrl={member.profilePhotoDataUrl}
        />
        <div className="min-w-0 flex-1">
          <MemberHeader
            title={member.fullName}
            subtitle={`${member.memberNumber} · ${member.phone} · Joined ${memberDate(member.joiningDate)}`}
          >
            {member.status !== 'ARCHIVED' && (
              <>
                <Link
                  className="button"
                  href={href(`/admin/members/${id}/edit`)}
                >
                  Edit Member
                </Link>
                <ArchiveMemberDialog id={id} name={member.fullName} />
              </>
            )}
          </MemberHeader>
        </div>
      </div>
      <MemberStatusBadge status={member.status} />
      <p className="text-sm text-slate-500">
        Registration branch:{' '}
        {current?.business.branches.find((b) => b.id === member.branchId)
          ?.name || 'Unassigned'}
      </p>
      {['created', 'updated'].includes(params.get('notice') || '') &&
        member.status !== 'ARCHIVED' && (
          <p
            role="status"
            className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
          >
            Member {params.get('notice')} successfully.
          </p>
        )}
      {member.status === 'ARCHIVED' && (
        <p
          role="status"
          className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900"
        >
          This member is archived and read-only. Historical records are
          preserved.
        </p>
      )}
      {member.status === 'INACTIVE' && (
        <p className="text-sm text-amber-800">
          This member is temporarily inactive.
        </p>
      )}
      <nav
        aria-label="Member sections"
        className="flex flex-wrap gap-2 border-b border-slate-200 pb-3"
      >
        {[
          'Overview',
          'Memberships',
          'Payments',
          'Account access',
          'Attendance',
          'Activity',
        ].map((name) => (
          <button
            key={name}
            aria-pressed={tab === name}
            className={
              tab === name
                ? 'bg-blue-50 text-blue-700'
                : 'bg-transparent text-slate-500'
            }
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </nav>
      {tab === 'Overview' ? (
        <MemberOverview member={member} />
      ) : tab === 'Account access' ? (
        <MemberInvitationPanel
          memberId={id}
          name={member.fullName}
          email={member.email}
        />
      ) : tab === 'Memberships' ? (
        <MembershipList memberId={id} />
      ) : tab === 'Payments' ? (
        <FinancePanel memberId={id} />
      ) : tab === 'Attendance' ? (
        <AttendancePage memberId={id} />
      ) : tab === 'Activity' ? (
        <Card className="p-6">
          <h2>Recent member activity</h2>
          <p className="mt-1 text-xs text-slate-500">Latest 50 changes</p>
          <ul className="mt-4 divide-y divide-slate-100">
            {member.activity.map((event) => (
              <li
                className="flex flex-wrap justify-between gap-2 py-3 text-sm"
                key={event.id}
              >
                <span>{activityLabels[event.action]}</span>
                <time className="text-slate-500" dateTime={event.occurredAt}>
                  {memberDate(event.occurredAt, member.business.timezone)}
                </time>
              </li>
            ))}
          </ul>
          {!member.activity.length && <p>No activity yet.</p>}
        </Card>
      ) : (
        <Card className="p-8">
          <h2>{tab}</h2>
          <p className="mt-3 text-sm text-slate-500">{empty[tab]}</p>
        </Card>
      )}
    </div>
  );
}
