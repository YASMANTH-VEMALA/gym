'use client';
import { useState, type ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { useBusinessQuery, type PageResult } from './data';
export function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="min-w-0 space-y-4 p-5 sm:p-6">
      <h2>{title}</h2>
      {children}
    </Card>
  );
}
export function LoadState({
  pending,
  error,
  retry,
}: {
  pending: boolean;
  error: Error | null;
  retry: () => unknown;
}) {
  return pending ? (
    <p role="status" className="rounded-xl bg-white p-6">
      Loading…
    </p>
  ) : error ? (
    <Panel title="Unable to load">
      <p role="alert" className="text-red-700">
        {error.message}
      </p>
      <button onClick={() => void retry()}>Retry</button>
    </Panel>
  ) : null;
}
export function Status({ value }: { value: string }) {
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
      {value.replaceAll('_', ' ')}
    </span>
  );
}
export function Picker({
  resource,
  label,
  value,
  onChange,
  filters = {},
}: {
  resource: string;
  label: string;
  value: string;
  onChange: (id: string) => void;
  filters?: Record<string, string>;
}) {
  const [search, setSearch] = useState('');
  const query = useBusinessQuery<
    PageResult<{
      id: string;
      name?: string;
      fullName?: string;
      memberNumber?: string;
    }>
  >(resource, { search, pageSize: '100', ...filters });
  return (
    <div className="space-y-2">
      <label>
        Find {label.toLowerCase()}
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name"
          maxLength={100}
        />
      </label>
      <label>
        {label}
        <select
          required
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Select {label.toLowerCase()}</option>
          {value && !query.data?.items.some((item) => item.id === value) && (
            <option value={value}>Selected {label.toLowerCase()}</option>
          )}
          {query.data?.items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.fullName || item.name}
              {item.memberNumber ? ` · ${item.memberNumber}` : ''}
            </option>
          ))}
        </select>
      </label>
      {query.error && <p role="alert">{query.error.message}</p>}
    </div>
  );
}
export function Pager({
  page,
  total,
  size,
  onPage,
}: {
  page: number;
  total: number;
  size: number;
  onPage: (value: number) => void;
}) {
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-3"
    >
      <span className="text-sm text-slate-500">
        Page {page} of {Math.max(1, Math.ceil(total / size))} · {total} records
      </span>
      <div className="flex gap-2">
        <button disabled={page === 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <button
          disabled={page * size >= total}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
