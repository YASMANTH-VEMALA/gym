'use client';
import { useState } from 'react';
import { calendarToday, formatMoneyMinor } from '@gym/validation';
import { useMutation } from '@tanstack/react-query';
import { useAdminContext } from '@/features/admin/admin-context';
import { useBusinessQuery } from '@/features/product/data';
import { Panel, Pager, LoadState, Picker } from '@/features/product/ui';
import { api } from '@/lib/api/auth-api';
interface Report {
  columns: { key: string; label: string; kind: string }[];
  rows: Record<string, string | number | null>[];
  metrics: Record<string, number>;
  distributions: Record<string, { label: string; count: number }[]>;
  total: number;
  page: number;
  pageSize: number;
  currency: string;
  timezone: string;
  from: string;
  to: string;
  dateBasis: string;
}
const names: Record<string, string> = {
  'people-status': 'People & Status',
  attendance: 'Attendance',
  collections: 'Collections',
  dues: 'Dues',
  memberships: 'Memberships',
  members: 'Members',
  branches: 'Branches',
  staff: 'Staff',
};
const statuses: Record<string, string[]> = {
  'people-status': ['ALL', 'ACTIVE', 'INACTIVE', 'ARCHIVED'],
  attendance: ['ALL'],
  collections: ['ALL'],
  dues: ['ALL', 'OPEN', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID'],
  memberships: ['ALL', 'ACTIVE', 'UPCOMING', 'EXPIRED', 'CANCELLED'],
  members: ['ALL', 'ACTIVE', 'INACTIVE', 'ARCHIVED'],
  branches: ['ALL', 'ACTIVE', 'ARCHIVED'],
  staff: ['ALL', 'ACTIVE', 'INACTIVE', 'ARCHIVED'],
};
const moneyMetrics = new Set([
  'Total collected',
  'Cash',
  'UPI',
  'Bank transfer',
  'Card',
  'Other',
  'Outstanding',
  'Overdue',
  'Promised',
  'Paid amount',
  'Collections',
  'Cash collected',
]);
export function ReportsPage() {
  const { current, branchId } = useAdminContext();
  const today = calendarToday(current!.business.timezone);
  const [type, setType] = useState('people-status'),
    [from, setFrom] = useState(today.slice(0, 7) + '-01'),
    [to, setTo] = useState(today),
    [status, setStatus] = useState('ALL'),
    [method, setMethod] = useState('ALL'),
    [planId, setPlan] = useState(''),
    [page, setPage] = useState(1);
  const filters = {
    from,
    to,
    status,
    method,
    ...(branchId ? { branchId } : {}),
    ...(planId ? { planId } : {}),
  };
  const query = useBusinessQuery<Report>(`reports/${type}`, {
    ...filters,
    page: String(page),
  });
  const download = useMutation({
    mutationFn: () =>
      api<{ filename: string; csv: string }>(
        `/businesses/${current!.businessId}/reports/${type}/export?${new URLSearchParams(filters)}`,
      ),
    onSuccess: (result) => {
      const url = URL.createObjectURL(
        new Blob([result.csv], { type: 'text/csv;charset=utf-8' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  });
  const data = query.data;
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">Reports</h1>
          <p className="mt-2 text-sm text-slate-500">
            Live business records, filtered and aggregated securely.
          </p>
        </div>
        <button
          disabled={!data || download.isPending}
          onClick={() => download.mutate()}
        >
          Download Excel CSV
        </button>
      </header>
      <Panel title="Report filters">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label>
            Report type
            <select
              aria-label="Report type"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setStatus('ALL');
                setMethod('ALL');
                setPlan('');
                setPage(1);
                download.reset();
              }}
            >
              {Object.entries(names).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Report from
            <input
              type="date"
              required
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Report to
            <input
              type="date"
              required
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </label>
          {type !== 'collections' && (
            <label>
              Report status
              <select
                aria-label="Report status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                {statuses[type]!.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          )}
          {type === 'collections' && (
            <label>
              Payment method
              <select
                aria-label="Report payment method"
                value={method}
                onChange={(e) => {
                  setMethod(e.target.value);
                  setPage(1);
                }}
              >
                {['ALL', 'CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'OTHER'].map(
                  (m) => (
                    <option key={m}>{m}</option>
                  ),
                )}
              </select>
            </label>
          )}
        </div>
        {['collections', 'dues', 'memberships'].includes(type) && (
          <details>
            <summary className="cursor-pointer text-sm text-blue-700">
              Filter by plan
            </summary>
            <Picker
              resource="membership-plans"
              label="Report plan"
              value={planId}
              onChange={(id) => {
                setPlan(id);
                setPage(1);
              }}
            />
            {planId && (
              <button
                onClick={() => {
                  setPlan('');
                  setPage(1);
                }}
              >
                Clear plan filter
              </button>
            )}
          </details>
        )}
        <p className="text-xs text-slate-500">
          Use the business and branch selectors above. Dates use{' '}
          {current!.business.timezone}. Maximum range: 731 days.
        </p>
      </Panel>
      {download.error && (
        <p role="alert" className="text-red-700">
          {download.error.message}
        </p>
      )}
      <LoadState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
      />
      {data && (
        <>
          <p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">
            {data.dateBasis}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Object.entries(data.metrics).map(([label, value]) => (
              <Panel key={label} title={label}>
                <p className="text-2xl font-semibold">
                  {moneyMetrics.has(label)
                    ? formatMoneyMinor(value, data.currency)
                    : value.toLocaleString()}
                </p>
              </Panel>
            ))}
          </div>
          <Panel title={`${names[type]} report`}>
            <p className="text-xs text-slate-500">
              {data.from} to {data.to} · {data.total} rows · {data.currency}.
              CSV monetary columns contain exact integer minor units.
            </p>
            {!data.rows.length ? (
              <p>No records match this report.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="sticky top-0 border-b border-slate-300 bg-slate-50">
                    <tr>
                      {data.columns.map((c) => (
                        <th
                          className="whitespace-nowrap border border-slate-200 p-3"
                          key={c.key}
                        >
                          {c.kind === 'money'
                            ? c.label.replace(' (minor units)', '')
                            : c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.rows.map((row, i) => (
                      <tr key={String(row.id || i)}>
                        {data.columns.map((c) => (
                          <td
                            className="whitespace-nowrap border border-slate-200 p-3"
                            key={c.key}
                          >
                            {c.kind === 'money'
                              ? formatMoneyMinor(
                                  Number(row[c.key] || 0),
                                  data.currency,
                                )
                              : (row[c.key] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pager
              page={page}
              total={data.total}
              size={data.pageSize}
              onPage={setPage}
            />
          </Panel>
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(data.distributions).map(([title, rows]) => (
              <Panel key={title} title={title}>
                <p className="text-xs text-slate-500">
                  Up to 100 groups, using the report filters.
                </p>
                {!rows.length ? (
                  <p>No distribution data.</p>
                ) : (
                  <ul className="space-y-2">
                    {rows.map((row) => (
                      <li
                        key={row.label}
                        className="flex justify-between gap-3 text-sm"
                      >
                        <span>{row.label}</span>
                        <strong>{row.count}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
