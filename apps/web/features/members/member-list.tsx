'use client';
import Link from 'next/link';
import { formatMoneyMinor } from '@gym/validation';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Plus, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useAdminContext } from '@/features/admin/admin-context';
import { useMembers } from './use-members';
import {
  MemberAvatar,
  MemberError,
  MemberHeader,
  MemberLoading,
  MemberStatusBadge,
  memberDate,
} from './member-shared';
export function MemberListView() {
  const { current, branchId, isBranchLocked, assignedBranchName, href } = useAdminContext();
  const params = useSearchParams();
  const router = useRouter();
  const [changing, startTransition] = useTransition();
  const search = params.get('search') || '';
  const status = ['ACTIVE', 'INACTIVE', 'ARCHIVED', 'ALL'].includes(
    params.get('status') || '',
  )
    ? params.get('status')!
    : 'ACTIVE';
  const page = Math.min(
    100000,
    Math.max(1, Math.floor(Number(params.get('page')) || 1)),
  );
  const query = useMembers({
    search,
    status,
    page: String(page),
    ...(branchId ? { branchId } : {}),
  });
  function filter(values: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    startTransition(() =>
      router.replace(`/admin/members?${next}`, { scroll: false }),
    );
  }
  return (
    <div className="space-y-6" aria-busy={changing}>
      <MemberHeader
        title="Members"
        subtitle="Manage gym members and their profiles."
      >
        <Link className="button gap-2" href={href('/admin/members/new')}>
          <Plus size={16} />
          Add Member
        </Link>
      </MemberHeader>
      {isBranchLocked ? (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900 flex items-center gap-2">
          <span>🔒</span>
          <span>Branch Manager Scope: Showing members exclusively for <strong>{assignedBranchName}</strong>.</span>
        </div>
      ) : branchId ? (
        <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
          Showing members registered at the selected branch. Choose All branches
          to find unassigned members.
        </p>
      ) : null}
      <Card className="p-4">
        <form
          key={`${search}:${status}`}
          className="flex flex-wrap items-end gap-3 space-y-0"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            filter({
              search: String(data.get('search')).trim(),
              status: String(data.get('status')),
              page: '1',
            });
          }}
        >
          <label className="min-w-48 flex-1">
            Search members
            <input
              name="search"
              defaultValue={search}
              disabled={changing}
              placeholder="Name, member number, phone or email"
              maxLength={120}
            />
          </label>
          <label className="w-40">
            Status
            <select
              aria-label="Status"
              name="status"
              disabled={changing}
              defaultValue={status}
              onChange={(event) =>
                filter({ status: event.target.value, page: '1' })
              }
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ARCHIVED">Archived</option>
              <option value="ALL">All statuses</option>
            </select>
          </label>
          <button disabled={changing}>Search</button>
        </form>
      </Card>
      {query.isPending ? (
        <MemberLoading />
      ) : query.error ? (
        <MemberError error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {query.data.total} member{query.data.total === 1 ? '' : 's'} ·{' '}
            {branchId
              ? current?.business.branches.find((b) => b.id === branchId)?.name
              : current?.business.name}
          </p>
          {query.data.items.length === 0 ? (
            <Card className="space-y-3 p-10 text-center">
              <Users className="mx-auto text-slate-400" />
              <h2>No members found</h2>
              <p className="text-sm text-slate-500">
                Add a member or adjust your filters.
              </p>
            </Card>
          ) : (
            <>
              <Card className="hidden overflow-x-auto lg:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      {[
                        'Member',
                        'Branch',
                        'Member ID',
                        'Phone',
                        'Joining Date',
                        'Membership',
                        'Due',
                        'Status',
                        'Actions',
                      ].map((label) => (
                        <th className="px-4 py-3" key={label}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {query.data.items.map((member) => (
                      <tr key={member.id}>
                        <td className="max-w-56 break-words px-4 py-4">
                          <Link
                            className="font-medium text-blue-700"
                            href={href(`/admin/members/${member.id}`)}
                          >
                            {member.fullName}
                          </Link>
                        </td>
                        <td className="px-4 py-4">
                          {current?.business.branches.find(
                            (b) => b.id === member.branchId,
                          )?.name || 'Unassigned'}
                        </td>
                        <td className="px-4 py-4 font-mono text-xs">
                          {member.memberNumber}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          {member.phone}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          {memberDate(member.joiningDate)}
                        </td>
                        <td className="px-4 py-4 text-slate-500">
                          {member.membershipCount
                            ? `${member.membershipCount} memberships`
                            : 'No membership'}
                        </td>
                        <td className="px-4 py-4">
                          {member.membershipCount
                            ? formatMoneyMinor(
                                member.outstandingMinor || 0,
                                current?.business.currency || 'INR',
                              )
                            : '—'}
                        </td>
                        <td className="px-4 py-4">
                          <MemberStatusBadge status={member.status} />
                        </td>
                        <td className="px-4 py-4">
                          <Link
                            className="text-blue-700"
                            href={href(`/admin/members/${member.id}`)}
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              <div className="grid gap-4 md:grid-cols-2 lg:hidden">
                {query.data.items.map((member) => (
                  <Card className="min-w-0 space-y-4 p-5" key={member.id}>
                    <div className="flex items-center gap-3">
                      <MemberAvatar name={member.fullName} />
                      <div className="min-w-0">
                        <Link
                          className="break-words font-semibold text-blue-700"
                          href={href(`/admin/members/${member.id}`)}
                        >
                          {member.fullName}
                        </Link>
                        <p className="mt-1 font-mono text-xs text-slate-500">
                          {member.memberNumber}
                        </p>
                      </div>
                    </div>
                    <MemberStatusBadge status={member.status} />
                    <p>
                      {current?.business.branches.find(
                        (b) => b.id === member.branchId,
                      )?.name || 'Unassigned'}
                    </p>
                    <p className="text-sm">{member.phone}</p>
                    <p className="text-sm text-slate-500">
                      Joined {memberDate(member.joiningDate)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {member.membershipCount
                        ? `${member.membershipCount} memberships · Due: ${formatMoneyMinor(member.outstandingMinor || 0, current?.business.currency || 'INR')}`
                        : 'No membership · Due: —'}
                    </p>
                    <Link
                      className="text-sm text-blue-700"
                      href={href(`/admin/members/${member.id}`)}
                    >
                      View member
                    </Link>
                  </Card>
                ))}
              </div>
            </>
          )}
          <nav
            aria-label="Member pagination"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-sm text-slate-500">
              Page {page} of{' '}
              {Math.max(1, Math.ceil(query.data.total / query.data.pageSize))}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 1 || changing}
                onClick={() => filter({ page: String(page - 1) })}
              >
                Previous
              </button>
              <button
                disabled={
                  page * query.data.pageSize >= query.data.total || changing
                }
                onClick={() => filter({ page: String(page + 1) })}
              >
                Next
              </button>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
