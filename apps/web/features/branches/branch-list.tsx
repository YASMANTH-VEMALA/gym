'use client';
import Link from 'next/link';
import { useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useAdminContext } from '@/features/admin/admin-context';
import { useBranches } from './use-branches';
import {
  BranchHeader,
  BranchStatusBadge,
  BranchError,
  BranchLoading,
  branchDate,
  branchLocation,
} from './branch-shared';

export function BranchListView() {
  const { current, href } = useAdminContext();
  const params = useSearchParams();
  const router = useRouter();
  const [changingFilters, startTransition] = useTransition();
  const search = params.get('search') || '';
  const status = ['ACTIVE', 'ARCHIVED', 'ALL'].includes(
    params.get('status') || '',
  )
    ? params.get('status')!
    : 'ACTIVE';
  const page = Math.min(
    100000,
    Math.max(1, Math.floor(Number(params.get('page')) || 1)),
  );
  const query = useBranches({ search, status, page });
  function filter(values: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(values)) next.set(key, value);
    startTransition(() =>
      router.replace(`/admin/branches?${next}`, { scroll: false }),
    );
  }
  return (
    <div className="space-y-6" aria-busy={changingFilters}>
      <BranchHeader title="Branches" subtitle="Manage your gym locations.">
        <Link className="button gap-2" href={href('/admin/branches/new')}>
          <Plus size={16} />
          Add Branch
        </Link>
      </BranchHeader>
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
            Search branches
            <input
              name="search"
              disabled={changingFilters}
              defaultValue={search}
              placeholder="Name, code, or location"
              maxLength={100}
            />
          </label>
          <label className="w-40">
            Status
            <select
              aria-label="Status"
              disabled={changingFilters}
              name="status"
              defaultValue={status}
              onChange={(event) =>
                filter({ status: event.target.value, page: '1' })
              }
            >
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
              <option value="ALL">All statuses</option>
            </select>
          </label>
          <button type="submit" disabled={changingFilters}>
            Search
          </button>
        </form>
      </Card>
      {query.isPending ? (
        <BranchLoading />
      ) : query.error ? (
        <BranchError error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {query.data.total} {query.data.total === 1 ? 'branch' : 'branches'}{' '}
            · {current?.business.name}
          </p>
          {!query.data.items.length ? (
            <Card className="space-y-3 p-10 text-center">
              <MapPin className="mx-auto text-slate-400" />
              <h2>No branches found</h2>
              <p className="text-sm text-slate-500">
                {search || status !== 'ACTIVE'
                  ? 'Try a different search or status filter.'
                  : 'Add a branch to manage another gym location.'}
              </p>
            </Card>
          ) : (
            <>
              <Card className="hidden overflow-x-auto lg:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                    <tr>
                      {[
                        'Branch',
                        'Code',
                        'Location',
                        'Members',
                        'Staff',
                        'Status',
                        'Created',
                        'Actions',
                      ].map((label) => (
                        <th key={label} className="px-4 py-3 font-medium">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.items.map((branch) => (
                      <tr
                        key={branch.id}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="max-w-52 break-words px-4 py-4 font-medium">
                          <Link
                            className="text-blue-700"
                            href={href(`/admin/branches/${branch.id}`)}
                          >
                            {branch.name}
                          </Link>
                        </td>
                        <td className="px-4 py-4 font-mono text-xs">
                          {branch.code}
                        </td>
                        <td className="max-w-56 break-words px-4 py-4 text-slate-500">
                          {branchLocation(branch)}
                        </td>
                        <td className="px-4 py-4">{branch.memberCount}</td>
                        <td className="px-4 py-4">{branch.staffCount}</td>
                        <td className="px-4 py-4">
                          <BranchStatusBadge status={branch.status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-slate-500">
                          {branchDate(
                            branch.createdAt,
                            current?.business.timezone,
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <Link
                            className="font-medium text-blue-700"
                            href={href(`/admin/branches/${branch.id}`)}
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
                {query.data.items.map((branch) => (
                  <Card key={branch.id} className="min-w-0 space-y-3 p-5">
                    <div className="flex flex-wrap justify-between gap-2">
                      <Link
                        className="break-all font-semibold text-blue-700"
                        href={href(`/admin/branches/${branch.id}`)}
                      >
                        {branch.name}
                      </Link>
                      <BranchStatusBadge status={branch.status} />
                    </div>
                    <p className="font-mono text-xs text-slate-500">
                      {branch.code}
                    </p>
                    <p className="break-words text-sm text-slate-600">
                      {branchLocation(branch)}
                    </p>
                    <p className="text-sm">
                      {branch.memberCount} members · {branch.staffCount} staff
                    </p>
                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                      <span className="text-slate-500">
                        Created{' '}
                        {branchDate(
                          branch.createdAt,
                          current?.business.timezone,
                        )}
                      </span>
                      <Link
                        className="text-blue-700"
                        href={href(`/admin/branches/${branch.id}`)}
                      >
                        View branch
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
          <nav
            aria-label="Branch pagination"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-sm text-slate-500">
              Page {page} of{' '}
              {Math.max(1, Math.ceil(query.data.total / query.data.pageSize))}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => filter({ page: String(page - 1) })}
              >
                Previous
              </button>
              <button
                disabled={page * query.data.pageSize >= query.data.total}
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
