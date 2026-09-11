import type { DashboardResponse } from '@gym/types';
import { formatMoneyMinor } from '@gym/validation';
import { Card } from '@/components/ui/card';

export function formatMoney(amount: number, currency: string) {
  return formatMoneyMinor(amount, currency);
}

function Metric({
  label,
  value,
  detail,
  tone = 'default',
  ariaLabel,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: 'default' | 'danger';
  ariaLabel: string;
}) {
  return (
    <Card
      aria-label={ariaLabel}
      className="rounded-lg border-slate-200 p-5 shadow-none"
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p
        className={`mt-2 text-[26px] font-semibold tracking-tight ${
          tone === 'danger' ? 'text-rose-700' : 'text-slate-950'
        }`}
      >
        {value}
      </p>
      <p className="mt-1.5 text-xs text-slate-400">{detail}</p>
    </Card>
  );
}

export function DashboardMetrics({ data }: { data: DashboardResponse }) {
  const currency = data.business.currency;
  const membersWithDues =
    data.metrics.membersWithDuesCount ?? data.outstandingDues.length;
  const onFloor = data.metrics.activeOnFloorNow ?? data.metrics.todayCheckIns;

  return (
    <div className="space-y-4">
      {data.branchSummary.selected && (
        <p className="border-l-2 border-slate-900 pl-3 text-xs text-slate-600">
          Showing <strong>{data.branchSummary.selected.name}</strong>. Member and
          attendance totals are filtered to this branch.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric
          label="Active members"
          value={data.metrics.activeMembers.toLocaleString()}
          detail={`${data.metrics.totalMembers.toLocaleString()} registered · ${data.metrics.expiringSoon} expiring soon`}
          ariaLabel={`Total Members: ${data.metrics.totalMembers}`}
        />
        <Metric
          label="Visits today"
          value={data.metrics.todayCheckIns.toLocaleString()}
          detail={`${onFloor.toLocaleString()} currently on the floor`}
          ariaLabel={`Today's Attendance: ${data.metrics.todayCheckIns}`}
        />
        <Metric
          label="Cash collected"
          value={formatMoney(data.metrics.collections, currency)}
          detail={`${formatMoney(data.metrics.todayCashCollected ?? 0, currency)} recorded today`}
          ariaLabel={`Collections: ${formatMoney(data.metrics.collections, currency)}`}
        />
        <Metric
          label="Outstanding dues"
          value={formatMoney(data.metrics.outstandingDues, currency)}
          detail={`${membersWithDues.toLocaleString()} ${membersWithDues === 1 ? 'member' : 'members'} with a balance`}
          tone={data.metrics.outstandingDues > 0 ? 'danger' : 'default'}
          ariaLabel={`Outstanding Dues: ${formatMoney(data.metrics.outstandingDues, currency)}`}
        />
      </div>
    </div>
  );
}
