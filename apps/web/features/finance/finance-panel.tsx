'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  calendarToday,
  formatMoneyMinor,
  moneyInputValue,
  parseMoneyMinor,
} from '@gym/validation';
import { useAdminContext } from '@/features/admin/admin-context';
import {
  useBusinessAction,
  useBusinessQuery,
  type PageResult,
} from '@/features/product/data';
import { Panel, LoadState, Status, Pager } from '@/features/product/ui';
interface Due {
  id: string;
  branchId: string;
  memberId: string;
  membershipId: string;
  fullName: string;
  memberNumber: string;
  branchName: string;
  planNameSnapshot: string;
  originalAmountMinor: number;
  paidMinor: number;
  outstandingMinor: number;
  currency: string;
  dueDate: string;
  promiseToPayDate: string | null;
  status: string;
}
interface Payment {
  id: string;
  amountMinor: number;
  paidAt: string;
  method: string;
  status: string;
  reference: string | null;
  notes: string | null;
  voidReason: string | null;
  receivable: {
    membership: {
      planNameSnapshot: string;
      member: { fullName: string };
      branch: { name: string };
    };
  };
}
interface PaymentLedger extends PageResult<Payment> {
  metrics: { paymentCount: number; collectedMinor: number };
  branches: {
    branchId: string;
    branchName: string;
    paymentCount: number;
    collectedMinor: number;
  }[];
}
interface MemberOption {
  id: string;
  fullName: string;
  memberNumber: string;
  status: string;
}
function PaymentForm({ due, close }: { due: Due; close: () => void }) {
  const { current } = useAdminContext();
  const action = useBusinessAction();
  const [key] = useState(() => crypto.randomUUID());
  const [amount, setAmount] = useState(moneyInputValue(due.outstandingMinor));
  const method = 'CASH';
  const [paidAt, setDate] = useState(calendarToday(current!.business.timezone));
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [review, setReview] = useState<number | null>(null);
  const money = (n: number) => formatMoneyMinor(n, due.currency);
  return (
    <Panel title="Confirm payment">
      <p>
        {due.fullName} · {due.planNameSnapshot} · {due.branchName}
      </p>
      <p>
        Membership fee: {money(due.originalAmountMinor)} · Paid:{' '}
        {money(due.paidMinor)} · Outstanding: {money(due.outstandingMinor)}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const minor = parseMoneyMinor(amount);
            if (minor <= 0 || minor > due.outstandingMinor)
              throw new Error(
                'Enter a positive amount no greater than the outstanding balance.',
              );
            setError('');
            setReview(minor);
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <fieldset
          disabled={review !== null || action.isPending}
          className="grid gap-4 sm:grid-cols-2"
        >
          <label>
            Amount
            <input
              required
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label>
            Payment method
            <input value="Cash (manual)" readOnly />
          </label>
          <label>
            Payment date
            <input
              required
              type="date"
              max={calendarToday(current!.business.timezone)}
              value={paidAt}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Reference
            <input
              maxLength={120}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
          <label className="sm:col-span-2">
            Notes
            <textarea
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <button>Review payment</button>
        </fieldset>
      </form>
      {review !== null && (
        <div className="space-y-3 rounded-xl bg-blue-50 p-4">
          <p>
            Record {money(review)} by {method.replaceAll('_', ' ')} on {paidAt}.
            Remaining balance: {money(due.outstandingMinor - review)}.
          </p>
          <button
            disabled={action.isPending}
            onClick={() =>
              action.mutate(
                {
                  path: 'payments',
                  body: {
                    receivableId: due.id,
                    idempotencyKey: key,
                    amountMinor: review,
                    method,
                    paidAt,
                    reference,
                    notes,
                  },
                },
                { onSuccess: close },
              )
            }
          >
            Confirm payment
          </button>
          {!action.isError && (
            <button disabled={action.isPending} onClick={() => setReview(null)}>
              Edit payment
            </button>
          )}
        </div>
      )}
      {(error || action.error) && (
        <p role="alert" className="text-red-700">
          {error || action.error?.message}
        </p>
      )}
      {action.isError && (
        <p className="text-sm">
          Retry the same payment safely. Check payment history before starting a
          different payment.
        </p>
      )}
      <button disabled={action.isPending} onClick={close}>
        Close payment
      </button>
    </Panel>
  );
}
function PromiseForm({ due }: { due: Due }) {
  const action = useBusinessAction();
  const [date, setDate] = useState(due.promiseToPayDate?.slice(0, 10) || '');
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        action.mutate({
          path: `dues/${due.id}/promise`,
          method: 'PATCH',
          body: { promiseToPayDate: date || null },
        });
      }}
    >
      <label>
        Promise-to-pay date
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <button disabled={action.isPending}>Save promise</button>
      {due.promiseToPayDate && (
        <button
          type="button"
          disabled={action.isPending}
          onClick={() =>
            action.mutate(
              {
                path: `dues/${due.id}/promise`,
                method: 'PATCH',
                body: { promiseToPayDate: null },
              },
              { onSuccess: () => setDate('') },
            )
          }
        >
          Clear promise
        </button>
      )}
      {action.error && <p role="alert">{action.error.message}</p>}
      {action.isSuccess && <p role="status">Promise updated.</p>}
    </form>
  );
}
function PaymentHistoryRow({
  payment,
  currency,
}: {
  payment: Payment;
  currency: string;
}) {
  const action = useBusinessAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  return (
    <li className="space-y-3 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p>
            {payment.receivable.membership.member.fullName} ·{' '}
            {formatMoneyMinor(payment.amountMinor, currency)}
          </p>
          <p className="text-sm text-slate-500">
            {payment.paidAt.slice(0, 10)} ·{' '}
            {payment.method.replaceAll('_', ' ')} ·{' '}
            {payment.receivable.membership.branch.name} ·{' '}
            {payment.receivable.membership.planNameSnapshot}
          </p>
        </div>
        <Status value={payment.status} />
        {payment.status === 'RECORDED' && (
          <button onClick={() => setOpen(!open)}>Void payment</button>
        )}
      </div>
      {payment.reference && <p>Reference: {payment.reference}</p>}
      {payment.notes && <p>Notes: {payment.notes}</p>}
      {payment.voidReason && <p>Void reason: {payment.voidReason}</p>}
      {open && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            action.mutate(
              { path: `payments/${payment.id}/void`, body: { reason } },
              { onSuccess: () => setOpen(false) },
            );
          }}
        >
          <p>
            Voiding preserves this record and restores the amount to the
            outstanding balance.
          </p>
          <label>
            Void reason
            <textarea
              required
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button disabled={action.isPending}>Confirm void</button>
          <button type="button" onClick={() => setOpen(false)}>
            Keep payment
          </button>
          {action.error && <p role="alert">{action.error.message}</p>}
        </form>
      )}
    </li>
  );
}
export function FinancePanel({
  memberId,
  membershipId,
}: {
  memberId?: string;
  membershipId?: string;
}) {
  const { current, branchId, isBranchLocked, assignedBranchName, href } =
    useAdminContext();
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [dueFrom, setFrom] = useState('');
  const [dueTo, setTo] = useState('');
  const [promiseDate, setPromise] = useState('');
  const [page, setPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [peopleSearch, setPeopleSearch] = useState('');
  const [collectionSelection, setCollectionSelection] = useState({
    branchId,
    memberId: memberId || '',
  });
  const today = calendarToday(current!.business.timezone);
  const [paymentMonth, setPaymentMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState<Due | null>(null);
  const [view, setView] = useState<'collect' | 'dues' | 'history'>('collect');
  const collectionMemberId =
    collectionSelection.branchId === branchId
      ? collectionSelection.memberId
      : '';
  const scope = {
    ...(memberId ? { memberId } : {}),
    ...(membershipId ? { membershipId } : {}),
    ...(branchId ? { branchId } : {}),
  };
  const dues = useBusinessQuery<
    PageResult<Due> & { metrics: Record<string, number> }
  >('dues', {
    ...scope,
    status,
    search,
    page: String(page),
    ...(dueFrom ? { dueFrom } : {}),
    ...(dueTo ? { dueTo } : {}),
    ...(promiseDate ? { promiseDate } : {}),
  });
  const collectionMembers = useBusinessQuery<PageResult<MemberOption>>(
    'members',
    {
      status: 'ACTIVE',
      pageSize: '100',
      ...(peopleSearch ? { search: peopleSearch } : {}),
      ...(branchId ? { branchId } : {}),
    },
  );
  const collectionDues = useBusinessQuery<PageResult<Due>>('dues', {
    status: 'OUTSTANDING',
    pageSize: '20',
    ...(collectionMemberId ? { memberId: collectionMemberId } : {}),
    ...(branchId ? { branchId } : {}),
  });
  const monthStart = `${paymentMonth}-01`;
  const monthEnd = new Date(`${paymentMonth}-01T00:00:00.000Z`);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
  monthEnd.setUTCDate(0);
  const monthLast = monthEnd.toISOString().slice(0, 10);
  const payments = useBusinessQuery<PaymentLedger>('payments', {
    ...scope,
    page: String(historyPage),
    paymentMethod: 'CASH',
    paidFrom: monthStart,
    paidTo: paymentMonth === today.slice(0, 7) ? today : monthLast,
  });
  const currency = current?.business.currency || 'INR';
  const newMembershipHref = href('/admin/memberships/new');
  const selectedBranchName = branchId
    ? current?.business.branches.find((branch) => branch.id === branchId)?.name
    : undefined;
  const visibleSelected =
    selected && (!branchId || selected.branchId === branchId) ? selected : null;
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Payments
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Collect a payment, follow up on balances, or review past transactions.
        </p>
      </header>
      <nav
        aria-label="Payment views"
        className="flex gap-1 border-b border-slate-200"
      >
        {(
          [
            ['collect', 'Collect payment'],
            ['dues', 'Outstanding dues'],
            ['history', 'Payment history'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            aria-current={view === key ? 'page' : undefined}
            className={`rounded-none border-b-2 bg-transparent px-4 py-2.5 text-sm shadow-none ${
              view === key
                ? 'border-slate-950 font-semibold text-slate-950'
                : 'border-transparent font-medium text-slate-500 hover:bg-transparent hover:text-slate-900'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {view === 'collect' && (
        <>
          <Panel title="Choose a member">
            {isBranchLocked ? (
              <p className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900 flex items-center gap-2">
                <span>
                  Branch:{' '}
                  <strong>{assignedBranchName || selectedBranchName}</strong>.
                  Payments are limited to this branch.
                </span>
              </p>
            ) : (
              <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
                Branch: <strong>{selectedBranchName || 'All Branches'}</strong>.
                To change it, use the branch selector at the top-right.
              </p>
            )}
            <label className="block max-w-md">
              Search name, phone, or member ID
              <input
                autoFocus
                value={peopleSearch}
                onChange={(event) => setPeopleSearch(event.target.value)}
                placeholder="Start typing the member's name"
                maxLength={120}
              />
            </label>
            <LoadState
              pending={collectionMembers.isPending}
              error={collectionMembers.error}
              retry={collectionMembers.refetch}
            />
            {collectionMembers.data &&
              (collectionMembers.data.items.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="border border-slate-200 p-3">Person</th>
                        <th className="border border-slate-200 p-3">
                          Member ID
                        </th>
                        <th className="border border-slate-200 p-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {collectionMembers.data.items.map((person) => {
                        const chosen = collectionMemberId === person.id;
                        return (
                          <tr
                            key={person.id}
                            className={chosen ? 'bg-blue-50' : undefined}
                          >
                            <td className="border border-slate-200 p-3 font-medium">
                              {person.fullName}
                            </td>
                            <td className="border border-slate-200 p-3">
                              {person.memberNumber}
                            </td>
                            <td className="border border-slate-200 p-3">
                              <button
                                aria-pressed={chosen}
                                onClick={() => {
                                  setCollectionSelection({
                                    branchId,
                                    memberId: person.id,
                                  });
                                  setSelected(null);
                                }}
                              >
                                {chosen ? 'Selected' : 'Choose person'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No active people found in this branch.</p>
              ))}
            {collectionMemberId && (
              <div className="border-t border-slate-200 pt-4">
                <h3 className="font-semibold">Choose a balance</h3>
                <LoadState
                  pending={collectionDues.isPending}
                  error={collectionDues.error}
                  retry={collectionDues.refetch}
                />
              </div>
            )}
            {collectionMemberId && collectionDues.data && (
              <>
                {!collectionDues.data.items.length ? (
                  <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                    <p>
                      This member has no unpaid membership in the selected
                      branch.
                    </p>
                    <Link
                      className="mt-3 inline-flex text-blue-700"
                      href={`${newMembershipHref}${newMembershipHref.includes('?') ? '&' : '?'}memberId=${collectionMemberId}`}
                    >
                      Assign a membership first
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {collectionDues.data.items.map((due) => (
                      <div
                        key={due.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"
                      >
                        <div>
                          <p className="font-medium">
                            {due.fullName} · {due.planNameSnapshot}
                          </p>
                          <p className="text-sm text-slate-500">
                            {due.branchName} · Outstanding{' '}
                            {formatMoneyMinor(
                              due.outstandingMinor,
                              due.currency,
                            )}
                          </p>
                        </div>
                        <button onClick={() => setSelected(due)}>
                          Collect cash
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </Panel>
          {visibleSelected && (
            <PaymentForm
              key={visibleSelected.id}
              due={visibleSelected}
              close={() => setSelected(null)}
            />
          )}
        </>
      )}

      {view === 'dues' && (
        <div className="space-y-5">
          <Panel title="Dues register">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="text-sm text-slate-500">
                Membership fees and payment status for{' '}
                {selectedBranchName || 'all branches'}.
              </p>
              <Link className="button" href={href('/admin/reports')}>
                Open full Excel report
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <label>
                Search member
                <input
                  maxLength={120}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label>
                Due status
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  {[
                    'OUTSTANDING',
                    'ALL',
                    'OPEN',
                    'PARTIALLY_PAID',
                    'PAID',
                    'OVERDUE',
                    'VOID',
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Due from
                <input
                  type="date"
                  value={dueFrom}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label>
                Due to
                <input
                  type="date"
                  value={dueTo}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label>
                Promise date
                <input
                  type="date"
                  value={promiseDate}
                  onChange={(e) => {
                    setPromise(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
            </div>
          </Panel>
          <LoadState
            pending={dues.isPending}
            error={dues.error}
            retry={dues.refetch}
          />
          {dues.data && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {Object.entries({
                  outstandingMinor: 'Outstanding',
                  overdueMinor: 'Overdue',
                  dueTodayMinor: 'Due today',
                  promisedWeekMinor: 'Promised this week',
                  membersWithDues: 'Members with dues',
                }).map(([key, label]) => (
                  <Panel key={key} title={label}>
                    <p className="text-xl font-semibold">
                      {key === 'membersWithDues'
                        ? dues.data.metrics[key]
                        : formatMoneyMinor(
                            dues.data.metrics[key] || 0,
                            currency,
                          )}
                    </p>
                  </Panel>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                Totals use the selected dues filters. This week is Monday to
                Sunday in {current?.business.timezone}.
              </p>
              <Panel title="Member balances">
                {!dues.data.items.length ? (
                  <p>No member payment records match this branch and filter.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead className="sticky top-0 bg-slate-50">
                        <tr>
                          {[
                            'Member',
                            'Member ID',
                            'Branch',
                            'Plan',
                            'Fee',
                            'Paid',
                            'Balance',
                            'Due date',
                            'Status',
                            'Action',
                          ].map((heading) => (
                            <th
                              key={heading}
                              className="whitespace-nowrap border border-slate-200 p-3"
                            >
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dues.data.items.map((due) => (
                          <tr key={due.id}>
                            <td className="whitespace-nowrap border border-slate-200 p-3 font-medium">
                              {due.fullName}
                            </td>
                            <td className="whitespace-nowrap border border-slate-200 p-3">
                              {due.memberNumber}
                            </td>
                            <td className="whitespace-nowrap border border-slate-200 p-3">
                              {due.branchName}
                            </td>
                            <td className="whitespace-nowrap border border-slate-200 p-3">
                              {due.planNameSnapshot}
                            </td>
                            <td className="whitespace-nowrap border border-slate-200 p-3">
                              {formatMoneyMinor(
                                due.originalAmountMinor,
                                due.currency,
                              )}
                            </td>
                            <td className="whitespace-nowrap border border-slate-200 p-3">
                              {formatMoneyMinor(due.paidMinor, due.currency)}
                            </td>
                            <td className="whitespace-nowrap border border-slate-200 p-3 font-semibold">
                              {formatMoneyMinor(
                                due.outstandingMinor,
                                due.currency,
                              )}
                            </td>
                            <td className="whitespace-nowrap border border-slate-200 p-3">
                              {due.dueDate.slice(0, 10)}
                            </td>
                            <td className="whitespace-nowrap border border-slate-200 p-3">
                              <Status value={due.status} />
                            </td>
                            <td className="min-w-44 border border-slate-200 p-3">
                              <div className="flex flex-col items-start gap-2">
                                {due.outstandingMinor > 0 ? (
                                  <button onClick={() => setSelected(due)}>
                                    Collect cash
                                  </button>
                                ) : (
                                  <span className="text-sm text-emerald-700">
                                    Fully paid
                                  </span>
                                )}
                                <Link
                                  className="text-blue-700"
                                  href={href(
                                    `/admin/memberships/${due.membershipId}`,
                                  )}
                                >
                                  View membership
                                </Link>
                                {due.outstandingMinor > 0 && (
                                  <details>
                                    <summary className="cursor-pointer text-blue-700">
                                      Promise date
                                    </summary>
                                    <PromiseForm
                                      key={`${due.id}-${due.promiseToPayDate}`}
                                      due={due}
                                    />
                                  </details>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
              <Pager
                page={page}
                total={dues.data.total}
                size={dues.data.pageSize}
                onPage={setPage}
              />
            </>
          )}
        </div>
      )}

      {view === 'history' && (
        <Panel title="Monthly cash ledger">
          <p className="text-sm text-slate-500">
            Manual collections for the selected month and branch. Choose All
            Branches above for the owner-wide view. Voided entries remain in the
            audit history but are excluded from totals.
          </p>
          <label className="mt-3 block max-w-xs">
            Collection month
            <input
              type="month"
              max={today.slice(0, 7)}
              value={paymentMonth}
              onChange={(event) => {
                if (!event.target.value) return;
                setPaymentMonth(event.target.value);
                setHistoryPage(1);
              }}
            />
          </label>
          <LoadState
            pending={payments.isPending}
            error={payments.error}
            retry={payments.refetch}
          />
          {payments.data && (
            <>
              <div className="my-4 grid gap-3 sm:grid-cols-2">
                <Panel title="Cash collected">
                  <p className="text-xl font-semibold">
                    {formatMoneyMinor(
                      payments.data.metrics.collectedMinor,
                      currency,
                    )}
                  </p>
                </Panel>
                <Panel title="Payments recorded">
                  <p className="text-xl font-semibold">
                    {payments.data.metrics.paymentCount}
                  </p>
                </Panel>
              </div>
              {!branchId && payments.data.branches.length > 0 && (
                <div className="mb-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200">
                      <tr>
                        <th className="p-3">Branch</th>
                        <th className="p-3">Cash collected</th>
                        <th className="p-3">Payments</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.data.branches.map((branch) => (
                        <tr key={branch.branchId}>
                          <td className="p-3">{branch.branchName}</td>
                          <td className="p-3">
                            {formatMoneyMinor(branch.collectedMinor, currency)}
                          </td>
                          <td className="p-3">{branch.paymentCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!payments.data.items.length && <p>No payments recorded yet.</p>}
              <ul className="divide-y divide-slate-100">
                {payments.data.items.map((p) => (
                  <PaymentHistoryRow
                    key={p.id}
                    payment={p}
                    currency={currency}
                  />
                ))}
              </ul>
              <Pager
                page={historyPage}
                total={payments.data.total}
                size={payments.data.pageSize}
                onPage={setHistoryPage}
              />
            </>
          )}
        </Panel>
      )}
    </div>
  );
}
