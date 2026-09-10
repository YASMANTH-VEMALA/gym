'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Plus, CreditCard } from 'lucide-react';
import { formatMoneyMinor } from '@gym/validation';
import { Card } from '@/components/ui/card';
import { useAdminContext } from '@/features/admin/admin-context';
import { useMembershipPlans } from './use-membership-plans';
import {
  PlanHeader,
  PlanLoading,
  PlanError,
  PlanStatusBadge,
  planDate,
  planAvailability,
} from './plan-shared';
export function PlanListView() {
  const { current, branchId, href } = useAdminContext();
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
  const query = useMembershipPlans({
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
      router.replace(`/admin/membership-plans?${next}`, { scroll: false }),
    );
  }
  const money = (minor: number) =>
    formatMoneyMinor(minor, current?.business.currency || 'INR');
  return (
    <div className="space-y-6" aria-busy={changing}>
      <PlanHeader
        title="Membership Plans"
        subtitle="Create and manage membership options for your gym."
      >
        <Link
          className="button gap-2"
          href={href('/admin/membership-plans/new')}
        >
          <Plus size={16} />
          Create Plan
        </Link>
      </PlanHeader>
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
            Search plans
            <input
              disabled={changing}
              name="search"
              defaultValue={search}
              placeholder="Plan name"
              maxLength={120}
            />
          </label>
          <label className="w-40">
            Status
            <select
              aria-label="Status"
              disabled={changing}
              name="status"
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
          <button disabled={changing} type="submit">
            Search
          </button>
        </form>
      </Card>
      {branchId && (
        <p className="text-sm text-slate-500">
          Showing plans for{' '}
          {
            current?.business.branches.find((branch) => branch.id === branchId)
              ?.name
          }
          , including all-branch plans.
        </p>
      )}
      {query.isPending ? (
        <PlanLoading />
      ) : query.error ? (
        <PlanError error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {query.data.total} {query.data.total === 1 ? 'plan' : 'plans'} ·{' '}
            {current?.business.name}
          </p>
          {!query.data.items.length ? (
            <Card className="space-y-3 p-10 text-center">
              <CreditCard className="mx-auto text-slate-400" />
              <h2>No plans found</h2>
              <p className="text-sm text-slate-500">
                {search || status !== 'ACTIVE' || branchId
                  ? 'Try a different search or filter.'
                  : 'Create your first membership plan to begin.'}
              </p>
            </Card>
          ) : (
            <>
              <Card className="hidden overflow-x-auto lg:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                    <tr>
                      {[
                        'Plan',
                        'Price',
                        'Duration',
                        'Branch Availability',
                        'Active Members',
                        'Status',
                        'Created',
                        'Actions',
                      ].map((label) => (
                        <th className="px-4 py-3 font-medium" key={label}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.items.map((plan) => (
                      <tr
                        className="border-b border-slate-100 last:border-0"
                        key={plan.id}
                      >
                        <td className="max-w-48 break-words px-4 py-4">
                          <Link
                            className="font-medium text-blue-700"
                            href={href(`/admin/membership-plans/${plan.id}`)}
                          >
                            {plan.name}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 font-medium">
                          {money(plan.priceMinor)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          {plan.durationDays} days
                        </td>
                        <td className="max-w-56 break-words px-4 py-4 text-slate-500">
                          {planAvailability(plan)}
                        </td>
                        <td className="px-4 py-4">{plan.activeMembers}</td>
                        <td className="px-4 py-4">
                          <PlanStatusBadge status={plan.status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-slate-500">
                          {planDate(plan.createdAt, current?.business.timezone)}
                        </td>
                        <td className="px-4 py-4">
                          <Link
                            className="text-blue-700"
                            href={href(`/admin/membership-plans/${plan.id}`)}
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
                {query.data.items.map((plan) => (
                  <Card className="min-w-0 space-y-4 p-5" key={plan.id}>
                    <div className="flex flex-wrap justify-between gap-2">
                      <Link
                        className="break-words font-semibold text-blue-700"
                        href={href(`/admin/membership-plans/${plan.id}`)}
                      >
                        {plan.name}
                      </Link>
                      <PlanStatusBadge status={plan.status} />
                    </div>
                    <p className="text-xl font-semibold">
                      {money(plan.priceMinor)}{' '}
                      <span className="text-sm font-normal text-slate-500">
                        / {plan.durationDays} days
                      </span>
                    </p>
                    <p className="break-words text-sm text-slate-500">
                      {planAvailability(plan)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {plan.activeMembers} active members · Created{' '}
                      {planDate(plan.createdAt, current?.business.timezone)}
                    </p>
                    <Link
                      className="text-sm text-blue-700"
                      href={href(`/admin/membership-plans/${plan.id}`)}
                    >
                      View plan
                    </Link>
                  </Card>
                ))}
              </div>
            </>
          )}
          <nav
            aria-label="Plan pagination"
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
