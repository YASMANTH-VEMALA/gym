'use client';
import Link from 'next/link';
import { FinancePanel } from '@/features/finance/finance-panel';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  calendarToday,
  formatMoneyMinor,
  parseMoneyMinor,
} from '@gym/validation';
import { useAdminContext } from '@/features/admin/admin-context';
import {
  useBusinessQuery,
  useBusinessAction,
  type MembershipRecord,
  type PageResult,
} from '@/features/product/data';
import { Panel, LoadState, Status, Picker, Pager } from '@/features/product/ui';
export function MembershipList({
  memberId,
  planId,
}: {
  memberId?: string;
  planId?: string;
}) {
  const { href, branchId, current } = useAdminContext();
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const query = useBusinessQuery<PageResult<MembershipRecord>>('memberships', {
    status,
    search,
    page: String(page),
    ...(memberId ? { memberId } : {}),
    ...(planId ? { planId } : {}),
    ...(branchId ? { branchId } : {}),
  });
  const newHref = href('/admin/memberships/new');
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">Memberships</h1>
          <p className="mt-2 text-sm text-slate-500">
            Membership terms and history for your gym.
          </p>
        </div>
        <Link
          className="button"
          href={
            memberId
              ? `${newHref}${newHref.includes('?') ? '&' : '?'}memberId=${memberId}`
              : newHref
          }
        >
          Assign Membership
        </Link>
      </header>
      <Panel title="Filters">
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            Search members
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              maxLength={120}
            />
          </label>
          <label>
            Status
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              {['ALL', 'ACTIVE', 'UPCOMING', 'EXPIRED', 'CANCELLED'].map(
                (s) => (
                  <option key={s}>{s}</option>
                ),
              )}
            </select>
          </label>
        </div>
      </Panel>
      <LoadState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
      />
      {query.data && (
        <>
          {!query.data.items.length ? (
            <Panel title="No memberships yet.">
              <p>Assign a plan to an active member and branch.</p>
            </Panel>
          ) : (
            query.data.items.map((item) => (
              <Panel key={item.id} title={item.planNameSnapshot}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p>
                      {item.member.fullName} · {item.member.memberNumber}
                    </p>
                    <p className="text-sm text-slate-500">
                      {item.branch.name} · {item.startDate} — {item.endDate}
                    </p>
                    <p className="mt-2">
                      {formatMoneyMinor(
                        item.priceMinorSnapshot,
                        current?.business.currency || 'INR',
                      )}
                    </p>
                  </div>
                  <Status value={item.status} />
                  <Link
                    className="text-blue-700"
                    href={href(`/admin/memberships/${item.id}`)}
                  >
                    View Membership
                  </Link>
                </div>
              </Panel>
            ))
          )}
          <Pager
            page={page}
            total={query.data.total}
            size={query.data.pageSize}
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}
export function AssignMembership() {
  const { current, href, branchId } = useAdminContext();
  const params = useSearchParams();
  const router = useRouter();
  const [memberId, setMember] = useState(params.get('memberId') || '');
  const [branch, setBranch] = useState(branchId || '');
  const [planId, setPlan] = useState('');
  const [newPlanName, setNewPlanName] = useState('Monthly');
  const [newPlanPrice, setNewPlanPrice] = useState('');
  const [newPlanDays, setNewPlanDays] = useState('30');
  const [planError, setPlanError] = useState('');
  const [date, setDate] = useState(
    calendarToday(current?.business.timezone || 'Asia/Kolkata'),
  );
  const [key, setKey] = useState(() => crypto.randomUUID());
  const action = useBusinessAction<{ id: string }>();
  const planAction = useBusinessAction<{ id: string }>();
  const availablePlans = useBusinessQuery<PageResult<{ id: string }>>(
    'membership-plans',
    {
      status: 'ACTIVE',
      pageSize: '1',
      ...(branch ? { branchId: branch } : {}),
    },
  );
  return (
    <div className="max-w-3xl space-y-5">
      <Link href={href('/admin/memberships')} className="text-blue-700">
        ← Memberships
      </Link>
      <h1 className="text-2xl">Assign Membership</h1>
      <Panel title="Membership terms">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            action.mutate(
              {
                path: 'memberships',
                body: {
                  memberId,
                  branchId: branch,
                  planId,
                  startDate: date,
                  idempotencyKey: key,
                },
              },
              {
                onSuccess: (item) =>
                  router.push(href(`/admin/memberships/${item.id}`)),
              },
            );
          }}
        >
          <fieldset disabled={action.isPending} className="space-y-5">
            <Picker
              resource="members"
              label="Member"
              value={memberId}
              onChange={(id) => {
                setMember(id);
                setKey(crypto.randomUUID());
              }}
            />
            <label>
              Branch
              <select
                aria-label="Membership branch"
                required
                value={branch}
                onChange={(e) => {
                  setBranch(e.target.value);
                  setPlan('');
                  setKey(crypto.randomUUID());
                }}
              >
                <option value="">Choose branch</option>
                {current?.business.branches
                  .filter((b) => b.status === 'ACTIVE')
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
              </select>
            </label>
            <Picker
              resource="membership-plans"
              label="Plan"
              value={planId}
              onChange={(id) => {
                setPlan(id);
                setKey(crypto.randomUUID());
              }}
              filters={branch ? { branchId: branch } : {}}
            />
            {branch && availablePlans.data?.total === 0 && (
              <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div>
                  <h3 className="font-semibold text-amber-950">
                    No plan is available for this branch
                  </h3>
                  <p className="text-sm text-amber-900">
                    Create the first plan here. It will be selected
                    automatically.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label>
                    Plan name
                    <input
                      value={newPlanName}
                      onChange={(event) => setNewPlanName(event.target.value)}
                      placeholder="Monthly"
                      maxLength={120}
                    />
                  </label>
                  <label>
                    Price
                    <input
                      value={newPlanPrice}
                      onChange={(event) => setNewPlanPrice(event.target.value)}
                      inputMode="decimal"
                      placeholder="1000.00"
                    />
                  </label>
                  <label>
                    Duration in days
                    <input
                      value={newPlanDays}
                      onChange={(event) => setNewPlanDays(event.target.value)}
                      inputMode="numeric"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  disabled={planAction.isPending}
                  onClick={() => {
                    try {
                      const priceMinor = parseMoneyMinor(newPlanPrice);
                      const durationDays = Number(newPlanDays);
                      if (!newPlanName.trim())
                        throw new Error('Enter a plan name.');
                      if (priceMinor <= 0)
                        throw new Error('Enter a price greater than zero.');
                      if (
                        !Number.isInteger(durationDays) ||
                        durationDays < 1 ||
                        durationDays > 3650
                      )
                        throw new Error(
                          'Duration must be between 1 and 3650 days.',
                        );
                      setPlanError('');
                      planAction.mutate(
                        {
                          path: 'membership-plans',
                          body: {
                            name: newPlanName.trim(),
                            priceMinor,
                            durationDays,
                            appliesToAllBranches: true,
                            branchIds: [],
                            status: 'ACTIVE',
                          },
                        },
                        {
                          onSuccess: (created) => {
                            setPlan(created.id);
                            setKey(crypto.randomUUID());
                          },
                        },
                      );
                    } catch (error) {
                      setPlanError((error as Error).message);
                    }
                  }}
                >
                  {planAction.isPending ? 'Creating plan…' : 'Create plan'}
                </button>
                {(planError || planAction.error) && (
                  <p role="alert" className="text-sm text-red-700">
                    {planError || planAction.error?.message}
                  </p>
                )}
              </div>
            )}
            <label>
              Start Date
              <input
                type="date"
                required
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setKey(crypto.randomUUID());
                }}
              />
            </label>
            <p className="text-sm text-slate-500">
              The current plan price and duration are saved with this
              membership. Later plan changes do not change these terms. End
              dates include the last calendar day.
            </p>
            <button
              disabled={!memberId || !branch || !planId || action.isPending}
            >
              Confirm Membership
            </button>
          </fieldset>
          {action.error && (
            <p role="alert" className="text-red-700">
              {action.error.message}
            </p>
          )}
        </form>
      </Panel>
    </div>
  );
}
export function MembershipDetail({ id }: { id: string }) {
  const { href } = useAdminContext();
  const query = useBusinessQuery<MembershipRecord>(`memberships/${id}`);
  const action = useBusinessAction();
  const [reason, setReason] = useState('');
  const [cancel, setCancel] = useState(false);
  const item = query.data;
  return (
    <div className="space-y-5">
      <Link href={href('/admin/memberships')} className="text-blue-700">
        ← Memberships
      </Link>
      <LoadState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
      />
      {item && (
        <>
          <h1 className="text-2xl">{item.planNameSnapshot}</h1>
          <Panel title="Membership details">
            <Status value={item.status} />
            <p>
              {item.member.fullName} · {item.member.memberNumber}
            </p>
            <p>{item.branch.name}</p>
            <p>
              {item.startDate} — {item.endDate} · {item.durationDaysSnapshot}{' '}
              days
            </p>
            <p>
              Agreed fee:{' '}
              {formatMoneyMinor(
                item.priceMinorSnapshot,
                item.business.currency,
              )}
            </p>
            <Link
              className="text-blue-700"
              href={href(`/admin/members/${item.memberId}`)}
            >
              View Member
            </Link>
            {item.status !== 'CANCELLED' && (
              <button className="bg-red-700" onClick={() => setCancel(true)}>
                Cancel Membership
              </button>
            )}
            {item.cancelReason && (
              <p>Cancellation reason: {item.cancelReason}</p>
            )}
          </Panel>
          <FinancePanel membershipId={id} />
          {cancel && (
            <Panel title="Confirm cancellation">
              <p>
                Cancellation ends operational access and preserves the
                membership history. The agreed fee remains payable; cancellation
                does not void payments or dues.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  action.mutate(
                    { path: `memberships/${id}/cancel`, body: { reason } },
                    { onSuccess: () => setCancel(false) },
                  );
                }}
              >
                <label>
                  Reason
                  <textarea
                    required
                    maxLength={500}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <button disabled={action.isPending}>
                  Confirm Cancellation
                </button>
                <button type="button" onClick={() => setCancel(false)}>
                  Keep Membership
                </button>
                {action.error && <p role="alert">{action.error.message}</p>}
              </form>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
