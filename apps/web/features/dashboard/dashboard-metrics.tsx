import {
  Users,
  UserCheck,
  Wallet,
  CircleDollarSign,
  ScanLine,
  CalendarClock,
  UserRoundCog,
} from 'lucide-react';
import type { DashboardResponse } from '@gym/types';
import { formatMoneyMinor } from '@gym/validation';
import { Card } from '@/components/ui/card';
export function formatMoney(amount: number, currency: string) {
  return formatMoneyMinor(amount, currency);
}
export function DashboardMetrics({ data }: { data: DashboardResponse }) {
  const items = [
    {
      label: 'Active Staff',
      value: data.metrics.totalStaff.toLocaleString(),
      icon: UserRoundCog,
      note: data.branchSummary.selected
        ? 'Assigned to this branch'
        : 'Across this business',
    },
    {
      label: 'Total Members',
      value: data.metrics.totalMembers.toLocaleString(),
      icon: Users,
      note: data.branchSummary.selected
        ? 'Registered at this branch'
        : 'Current profiles across this business',
    },
    {
      label: 'Active Members',
      value: data.metrics.activeMembers.toLocaleString(),
      icon: UserCheck,
      note: 'Profiles with Active status',
    },
    {
      label: 'Collections',
      value: formatMoney(data.metrics.collections, data.business.currency),
      icon: Wallet,
      note: 'Valid payments this calendar month',
    },
    {
      label: 'Outstanding Dues',
      value: formatMoney(data.metrics.outstandingDues, data.business.currency),
      icon: CircleDollarSign,
      note: 'Balance awaiting payment',
    },
  ];
  return (
    <div className="space-y-4">
      {data.branchSummary.selected && (
        <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
          Member counts show registrations at this branch. Financial totals show
          memberships purchased at this branch.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {items.map((item) => (
          <Card
            key={item.label}
            className="p-5"
            aria-label={`${item.label}: ${item.value}`}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-medium text-slate-500">
                {item.label}
              </h2>
              <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50/70 text-blue-600">
                <item.icon size={16} strokeWidth={1.8} aria-hidden="true" />
              </span>
            </div>
            <p className="mt-2 text-[30px] font-semibold leading-tight tracking-tight text-slate-900">
              {item.value}
            </p>
            <p className="mt-3 text-xs text-slate-500">{item.note}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex items-center gap-4 px-5 py-4">
          <span className="rounded-lg bg-slate-50 p-2.5 text-slate-500">
            <ScanLine size={18} aria-hidden="true" />
          </span>
          <div className="flex-1">
            <h2 className="text-xs font-medium text-slate-600">
              Today&apos;s Check-ins
            </h2>
            <p className="mt-1 text-xs text-slate-500">Attendance for today</p>
          </div>
          <p className="text-2xl font-semibold tabular-nums">
            {data.metrics.todayCheckIns}
          </p>
        </Card>
        <Card className="flex items-center gap-4 px-5 py-4">
          <span className="rounded-lg bg-slate-50 p-2.5 text-slate-500">
            <CalendarClock size={18} aria-hidden="true" />
          </span>
          <div className="flex-1">
            <h2 className="text-xs font-medium text-slate-600">
              Expiring Soon
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Upcoming membership renewals
            </p>
          </div>
          <p className="text-2xl font-semibold tabular-nums">
            {data.metrics.expiringSoon}
          </p>
        </Card>
      </div>
    </div>
  );
}
