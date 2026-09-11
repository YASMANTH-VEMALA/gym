import type { DashboardResponse } from '@gym/types';
import { formatMoneyMinor } from '@gym/validation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { useAdminContext } from '@/features/admin/admin-context';

function PanelHeader({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
      {href && action && (
        <Link
          href={href}
          className="shrink-0 text-xs font-medium text-slate-600 hover:text-slate-950"
        >
          {action} &rarr;
        </Link>
      )}
    </div>
  );
}

function EmptyMessage({ children }: { children: string }) {
  return (
    <div className="flex min-h-36 items-center justify-center px-5 py-8 text-center">
      <p className="max-w-sm text-xs leading-5 text-slate-400">{children}</p>
    </div>
  );
}

function Collections({ data }: { data: DashboardResponse }) {
  const { href } = useAdminContext();
  const rows = data.chartData.collections.slice(-7);
  const max = Math.max(...rows.map((row) => row.amountMinor), 1);

  return (
    <Card className="overflow-hidden rounded-lg shadow-none">
      <PanelHeader
        title="Collections"
        description="Cash recorded this month"
        href={href('/admin/payments')}
        action="View payments"
      />
      {!rows.length ? (
        <EmptyMessage>
          No payments yet. This chart will fill in as payments are recorded.
        </EmptyMessage>
      ) : (
        <div className="space-y-3 p-5">
          {rows.map((row) => (
            <div key={row.date} className="grid grid-cols-[5rem_1fr_auto] items-center gap-3 text-xs">
              <span className="text-slate-500">{row.date}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <span
                  className="block h-full rounded-full bg-slate-800"
                  style={{ width: `${Math.max(4, (row.amountMinor / max) * 100)}%` }}
                />
              </span>
              <strong className="font-medium text-slate-800">
                {formatMoneyMinor(row.amountMinor, data.business.currency)}
              </strong>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function MemberGrowth({ data }: { data: DashboardResponse }) {
  const { href } = useAdminContext();
  const rows = data.chartData.memberGrowth;

  return (
    <Card className="overflow-hidden rounded-lg shadow-none">
      <PanelHeader
        title="Member growth"
        description="New registrations over six months"
        href={href('/admin/members')}
        action="View members"
      />
      {!rows.length ? (
        <EmptyMessage>
          No registration history yet. Monthly totals will appear here.
        </EmptyMessage>
      ) : (
        <div className="grid grid-cols-3 gap-px bg-slate-100 sm:grid-cols-6">
          {rows.map((row) => (
            <div key={row.date} className="bg-white px-3 py-5 text-center">
              <p className="text-xl font-semibold text-slate-950">{row.count}</p>
              <p className="mt-1 text-[11px] text-slate-500">{row.date}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Attention({ data }: { data: DashboardResponse }) {
  const { href } = useAdminContext();
  const hasItems = data.outstandingDues.length || data.upcomingExpirations.length;

  return (
    <Card className="overflow-hidden rounded-lg shadow-none">
      <PanelHeader
        title="Needs attention"
        description="Dues and renewals to follow up"
      />
      {!hasItems ? (
        <EmptyMessage>
          Nothing needs attention. There are no outstanding dues or renewals in the next seven days.
        </EmptyMessage>
      ) : (
        <div className="divide-y divide-slate-100">
          {data.outstandingDues.map((row) => (
            <Link
              key={`due-${row.id}`}
              href={href('/admin/payments')}
              className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-slate-900">{row.memberName}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">Payment due {row.dueDate}</p>
              </div>
              <strong className="shrink-0 text-xs font-semibold text-rose-700">
                {formatMoneyMinor(row.amountMinor, data.business.currency)}
              </strong>
            </Link>
          ))}
          {data.upcomingExpirations.map((row) => (
            <Link
              key={`renewal-${row.id}`}
              href={href(`/admin/memberships/${row.id}`)}
              className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-slate-900">{row.memberName}</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">{row.planName}</p>
              </div>
              <span className="shrink-0 text-[11px] text-amber-700">Ends {row.endDate}</span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

function RecentActivity({ data }: { data: DashboardResponse }) {
  const format = new Intl.DateTimeFormat('en', {
    timeZone: data.business.timezone,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <Card className="overflow-hidden rounded-lg shadow-none">
      <PanelHeader
        title="Recent activity"
        description={data.activityScope === 'branch' ? 'This branch' : 'Across the business'}
      />
      {!data.recentActivity.length ? (
        <EmptyMessage>
          Check-ins, payments, and membership changes will appear here.
        </EmptyMessage>
      ) : (
        <ol className="divide-y divide-slate-100">
          {data.recentActivity.map((event) => (
            <li key={event.id} className="flex items-start gap-3 px-5 py-3.5">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium leading-5 text-slate-800">{event.label}</p>
                <time className="mt-0.5 block text-[11px] text-slate-400" dateTime={event.occurredAt}>
                  {format.format(new Date(event.occurredAt))}
                </time>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function DashboardSections({ data }: { data: DashboardResponse }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Collections data={data} />
        <MemberGrowth data={data} />
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Attention data={data} />
        <RecentActivity data={data} />
      </div>
    </div>
  );
}
