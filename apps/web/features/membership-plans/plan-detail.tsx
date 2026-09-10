'use client';
import { MembershipList } from '@/features/memberships/membership-pages';
import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { formatMoneyMinor } from '@gym/validation';
import { Card } from '@/components/ui/card';
import { useAdminContext } from '@/features/admin/admin-context';
import { useMembershipPlan } from './use-membership-plans';
import {
  PlanHeader,
  PlanBack,
  PlanLoading,
  PlanError,
  PlanStatusBadge,
  planAvailability,
  planDate,
} from './plan-shared';
import { ArchivePlanDialog } from './archive-plan-dialog';
export function PlanDetailView({ id }: { id: string }) {
  const { href } = useAdminContext();
  const query = useMembershipPlan(id);
  const params = useSearchParams();
  const [members, setMembers] = useState(false);
  if (query.isPending) return <PlanLoading />;
  if (query.error)
    return (
      <div className="space-y-4">
        <PlanBack href={href('/admin/membership-plans')} />
        <PlanError error={query.error} retry={() => void query.refetch()} />
      </div>
    );
  const plan = query.data;
  const money = (minor: number) =>
    formatMoneyMinor(minor, plan.business.currency);
  return (
    <div className="space-y-6">
      <PlanBack href={href('/admin/membership-plans')} />
      <PlanHeader
        title={plan.name}
        subtitle={`${money(plan.priceMinor)} · ${plan.durationDays} days · ${plan.business.name}`}
      >
        {plan.status !== 'ARCHIVED' && (
          <>
            <Link
              className="button"
              href={href(`/admin/membership-plans/${id}/edit`)}
            >
              Edit Plan
            </Link>
            <ArchivePlanDialog id={id} name={plan.name} />
          </>
        )}
      </PlanHeader>
      <PlanStatusBadge status={plan.status} />
      {['created', 'updated'].includes(params.get('notice') || '') &&
        plan.status !== 'ARCHIVED' && (
          <p
            role="status"
            className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
          >
            Plan {params.get('notice')} successfully.
          </p>
        )}
      {plan.status === 'INACTIVE' && (
        <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          This plan is temporarily unavailable for new memberships.
        </p>
      )}
      {plan.status === 'ARCHIVED' && (
        <p
          role="status"
          className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900"
        >
          This plan is archived and read-only. Historical records are preserved.
        </p>
      )}
      <nav
        aria-label="Plan sections"
        className="flex gap-2 border-b border-slate-200 pb-3"
      >
        <button
          aria-pressed={!members}
          onClick={() => setMembers(false)}
          className={
            !members
              ? 'bg-blue-50 text-blue-700'
              : 'bg-transparent text-slate-500'
          }
        >
          Plan Overview
        </button>
        <button
          aria-pressed={members}
          onClick={() => setMembers(true)}
          className={
            members
              ? 'bg-blue-50 text-blue-700'
              : 'bg-transparent text-slate-500'
          }
        >
          Members
        </button>
      </nav>
      {members ? (
        <MembershipList planId={id} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['Active Members', plan.metrics.activeMembers],
              ['Total Members', plan.metrics.totalMembers],
              ['Revenue', money(plan.metrics.revenueMinor)],
            ].map(([label, value]) => (
              <Card
                key={label}
                className="p-5"
                aria-label={`${label}: ${value}`}
              >
                <h2 className="text-sm font-medium text-slate-500">{label}</h2>
                <p className="mt-3 text-2xl font-semibold">{value}</p>
              </Card>
            ))}
          </div>
          <Card className="p-6">
            <h2>Plan information</h2>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-600">
              {plan.description || 'No description added.'}
            </p>
            <dl className="mt-6 grid gap-6 text-sm sm:grid-cols-2">
              {[
                ['Price', money(plan.priceMinor)],
                ['Duration', `${plan.durationDays} calendar days`],
                ['Branch availability', planAvailability(plan)],
                [
                  'Currently eligible branches',
                  plan.eligibleBranches
                    .map((branch) => branch.name)
                    .join(', ') || 'None',
                ],
                ['Created', planDate(plan.createdAt, plan.business.timezone)],
                ['Updated', planDate(plan.updatedAt, plan.business.timezone)],
              ].map(([label, value]) => (
                <div className="min-w-0" key={label}>
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="mt-1 break-words font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            {plan.appliesToAllBranches && (
              <p className="mt-6 text-xs text-slate-500">
                All-branch availability automatically includes newly created
                active branches.
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
