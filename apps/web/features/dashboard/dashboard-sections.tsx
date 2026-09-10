import {
  Activity,
  ChartNoAxesColumn,
  TrendingUp,
  CalendarDays,
  ReceiptText,
  Check,
  type LucideIcon,
} from 'lucide-react';
import type { DashboardResponse } from '@gym/types';
import Link from 'next/link';
import { formatMoneyMinor } from '@gym/validation';
import { useAdminContext } from '@/features/admin/admin-context';
import { Card } from '@/components/ui/card';
function EmptySection({
  title,
  subtitle,
  icon: Icon,
  message,
  detail,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  message: string;
  detail: string;
}) {
  return (
    <Card className="flex h-full flex-col">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      </div>
      <div className="flex min-h-48 flex-1 flex-col items-center justify-center px-6 py-7 text-center">
        <span className="mb-3 flex size-10 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-500">
          <Icon size={21} strokeWidth={1.5} aria-hidden="true" />
        </span>
        <p className="text-xs font-medium text-slate-600">{message}</p>
        <p className="mt-1.5 max-w-64 text-xs leading-relaxed text-slate-500">
          {detail}
        </p>
      </div>
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
    <Card className="h-full">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold">Recent Activity</h2>
        <span className="rounded-md bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500">
          Business-wide
        </span>
      </div>
      {!data.recentActivity.length ? (
        <div className="flex min-h-48 flex-col items-center justify-center p-6 text-center">
          <Activity
            className="mb-3 text-slate-300"
            size={26}
            aria-hidden="true"
          />
          <p className="text-xs font-medium text-slate-600">No activity yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Business and team updates will appear here.
          </p>
        </div>
      ) : (
        <ol className="divide-y divide-slate-100 px-5">
          {data.recentActivity.map((event) => (
            <li key={event.id} className="flex gap-3 py-4">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Check size={13} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium leading-relaxed text-slate-700">
                  {event.label}
                </p>
                <time
                  className="mt-1 block text-[11px] text-slate-500"
                  dateTime={event.occurredAt}
                >
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
  const { href } = useAdminContext();
  return (
    <>
      <div className="grid gap-5 lg:grid-cols-2">
        {data.chartData.collections.length ? (
          <Card className="space-y-4 p-5">
            <h2>Collections Overview</h2>
            <p className="text-xs text-slate-500">
              Daily collections this calendar month
            </p>
            <ul className="space-y-3">
              {data.chartData.collections.map((row) => (
                <li
                  key={row.date}
                  className="flex justify-between gap-3 text-sm"
                >
                  <span>{row.date}</span>
                  <strong>
                    {formatMoneyMinor(row.amountMinor, data.business.currency)}
                  </strong>
                </li>
              ))}
            </ul>
            <Link
              href={href('/admin/payments')}
              className="text-sm text-blue-700"
            >
              View payments
            </Link>
          </Card>
        ) : (
          <EmptySection
            title="Collections Overview"
            subtitle="Your gym's payment activity"
            icon={ChartNoAxesColumn}
            message="No collections yet"
            detail="Record a membership payment to see collections here."
          />
        )}
        {data.chartData.memberGrowth.length ? (
          <Card className="space-y-4 p-5">
            <h2>Member Growth</h2>
            <p className="text-xs text-slate-500">
              Profiles joined per month · business-wide · last six months
            </p>
            <ul className="space-y-3">
              {data.chartData.memberGrowth.map((row) => (
                <li
                  key={row.date}
                  className="flex justify-between gap-3 text-sm"
                >
                  <span>{row.date}</span>
                  <strong>{row.count} joined</strong>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <EmptySection
            title="Member Growth"
            subtitle="How your community grows over time"
            icon={TrendingUp}
            message="Your community starts here"
            detail="No joining dates in the last six months."
          />
        )}
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-3">
        <RecentActivity data={data} />
        {data.upcomingExpirations.length ? (
          <Card className="space-y-4 p-5">
            <h2>Upcoming Expirations</h2>
            <p className="text-xs text-slate-500">
              Next seven days · earliest five
            </p>
            <ul className="space-y-4">
              {data.upcomingExpirations.map((row) => (
                <li key={row.id}>
                  <Link
                    className="text-sm text-blue-700"
                    href={href(`/admin/memberships/${row.id}`)}
                  >
                    {row.memberName} · {row.planName}
                  </Link>
                  <p className="text-xs text-slate-500">Ends {row.endDate}</p>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <EmptySection
            title="Upcoming Expirations"
            subtitle="Memberships approaching renewal"
            icon={CalendarDays}
            message="No upcoming expirations"
            detail="No memberships expire in the next seven days."
          />
        )}
        {data.outstandingDues.length ? (
          <Card className="space-y-4 p-5">
            <h2>Outstanding Dues</h2>
            <p className="text-xs text-slate-500">
              Earliest five balances awaiting payment
            </p>
            <ul className="space-y-4">
              {data.outstandingDues.map((row) => (
                <li key={row.id}>
                  <Link
                    className="text-sm text-blue-700"
                    href={href(`/admin/memberships/${row.id}`)}
                  >
                    {row.memberName} ·{' '}
                    {formatMoneyMinor(row.amountMinor, data.business.currency)}
                  </Link>
                  <p className="text-xs text-slate-500">
                    Expected {row.dueDate}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <EmptySection
            title="Outstanding Dues"
            subtitle="Balances that need your attention"
            icon={ReceiptText}
            message="No dues to display"
            detail="There are no outstanding membership balances."
          />
        )}
      </div>
    </>
  );
}
