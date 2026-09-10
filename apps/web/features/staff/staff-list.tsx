'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Plus, UsersRound } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useAdminContext } from '@/features/admin/admin-context';
import { useStaffList } from './use-staff';
import {
  StaffError,
  StaffHeader,
  StaffLoading,
  StaffStatusBadge,
  displayDate,
} from './staff-shared';
export function StaffListView() {
  const { current, href, branchId } = useAdminContext();
  const params = useSearchParams();
  const router = useRouter();
  const [changing, startTransition] = useTransition();
  const search = params.get('search') || '';
  const status = ['ACTIVE', 'INACTIVE', 'ARCHIVED', 'ALL'].includes(
    params.get('status') || '',
  )
    ? params.get('status')!
    : 'ACTIVE';
  const jobTitle = params.get('jobTitle') || '';
  const page = Math.max(1, Math.floor(Number(params.get('page')) || 1));
  const filters = {
    search,
    status,
    jobTitle,
    page: String(page),
    ...(branchId ? { branchId } : {}),
  };
  const query = useStaffList(filters);
  function set(values: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    startTransition(() =>
      router.replace(`/admin/staff?${next}`, { scroll: false }),
    );
  }
  return (
    <div className="space-y-6" aria-busy={changing}>
      <StaffHeader
        title="Staff"
        subtitle="Manage employees and branch assignments."
      >
        <Link className="button gap-2" href={href('/admin/staff/new')}>
          <Plus size={16} />
          Add Staff
        </Link>
      </StaffHeader>
      <Card className="p-4">
        <form
          key={`${search}:${status}:${jobTitle}`}
          className="grid items-end gap-3 space-y-0 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            set({
              search: String(data.get('search')).trim(),
              jobTitle: String(data.get('jobTitle')).trim(),
              status: String(data.get('status')),
              page: '1',
            });
          }}
        >
          <label>
            Search staff
            <input
              disabled={changing}
              name="search"
              defaultValue={search}
              placeholder="Name, phone, or email"
            />
          </label>
          <label>
            Job title
            <input
              disabled={changing}
              name="jobTitle"
              defaultValue={jobTitle}
              placeholder="Any title"
            />
          </label>
          <label>
            Status
            <select
              aria-label="Status"
              disabled={changing}
              name="status"
              defaultValue={status}
              onChange={(e) => set({ status: e.target.value, page: '1' })}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ARCHIVED">Archived</option>
              <option value="ALL">All statuses</option>
            </select>
          </label>
          <button disabled={changing} type="submit">
            Search
          </button>
        </form>
      </Card>
      {branchId && (
        <p className="text-sm text-slate-500">
          Filtered by{' '}
          {
            current?.business.branches.find((branch) => branch.id === branchId)
              ?.name
          }{' '}
          using the global branch selector.
        </p>
      )}
      {query.isPending ? (
        <StaffLoading />
      ) : query.error ? (
        <StaffError error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {query.data.total}{' '}
            {query.data.total === 1 ? 'staff member' : 'staff members'} ·{' '}
            {current?.business.name}
          </p>
          {!query.data.items.length ? (
            <Card className="space-y-3 p-10 text-center">
              <UsersRound className="mx-auto text-slate-400" />
              <h2>No staff found</h2>
              <p className="text-sm text-slate-500">
                {search || jobTitle || status !== 'ACTIVE' || branchId
                  ? 'Try different filters.'
                  : 'Add your first staff member to begin.'}
              </p>
            </Card>
          ) : (
            <>
              <Card className="hidden overflow-x-auto lg:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-slate-50 text-xs text-slate-500">
                    <tr>
                      {[
                        'Staff Member',
                        'Phone',
                        'Job Title',
                        'Branches',
                        'Joining Date',
                        'Status',
                        'Actions',
                      ].map((label) => (
                        <th className="px-4 py-3 font-medium" key={label}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.items.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-4 py-4">
                          <Link
                            className="font-medium text-blue-700"
                            href={href(`/admin/staff/${item.id}`)}
                          >
                            {item.fullName}
                          </Link>
                          <p className="text-xs text-slate-500">
                            {item.email || 'No email'}
                          </p>
                        </td>
                        <td className="px-4 py-4">{item.phone}</td>
                        <td className="px-4 py-4">{item.jobTitle}</td>
                        <td className="max-w-56 px-4 py-4">
                          {item.branches
                            .map((branch) => branch.name)
                            .join(', ')}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          {displayDate(item.joiningDate)}
                        </td>
                        <td className="px-4 py-4">
                          <StaffStatusBadge status={item.status} />
                        </td>
                        <td className="px-4 py-4">
                          <Link
                            className="text-blue-700"
                            href={href(`/admin/staff/${item.id}`)}
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
                {query.data.items.map((item) => (
                  <Card className="min-w-0 space-y-3 p-5" key={item.id}>
                    <div className="flex flex-wrap justify-between gap-2">
                      <Link
                        className="break-words font-semibold text-blue-700"
                        href={href(`/admin/staff/${item.id}`)}
                      >
                        {item.fullName}
                      </Link>
                      <StaffStatusBadge status={item.status} />
                    </div>
                    <p className="text-sm">
                      {item.jobTitle} · {item.phone}
                    </p>
                    <p className="break-words text-sm text-slate-500">
                      {item.branches.map((branch) => branch.name).join(', ')}
                    </p>
                    <div className="flex justify-between gap-2 text-sm">
                      <span>Joined {displayDate(item.joiningDate)}</span>
                      <Link
                        className="text-blue-700"
                        href={href(`/admin/staff/${item.id}`)}
                      >
                        View staff
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
          <nav
            aria-label="Staff pagination"
            className="flex items-center justify-between gap-3"
          >
            <p className="text-sm text-slate-500">
              Page {page} of{' '}
              {Math.max(1, Math.ceil(query.data.total / query.data.pageSize))}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 1 || changing}
                onClick={() => set({ page: String(page - 1) })}
              >
                Previous
              </button>
              <button
                disabled={
                  page * query.data.pageSize >= query.data.total || changing
                }
                onClick={() => set({ page: String(page + 1) })}
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
