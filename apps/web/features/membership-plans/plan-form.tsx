'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { MembershipPlanDetail } from '@gym/types';
import { moneyInputValue, parseMoneyMinor } from '@gym/validation';
import { Card } from '@/components/ui/card';
import { useAdminContext } from '@/features/admin/admin-context';
import { planSchema, type PlanFormValues } from './plan-schema';
import {
  useMembershipPlan,
  useMembershipPlanMutation,
} from './use-membership-plans';
import { PlanHeader, PlanBack, PlanError, PlanLoading } from './plan-shared';
import { BranchApplicabilitySelector } from './branch-applicability-selector';
function PlanForm({ plan }: { plan?: MembershipPlanDetail }) {
  const { current, href } = useAdminContext();
  const router = useRouter();
  const mutation = useMembershipPlanMutation(
    plan ? 'update' : 'create',
    plan?.id,
  );
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: plan?.name || '',
      description: plan?.description || '',
      price: plan ? moneyInputValue(plan.priceMinor) : '',
      durationDays: plan ? String(plan.durationDays) : '30',
      appliesToAllBranches: plan?.appliesToAllBranches ?? true,
      branchIds: plan?.branches.map((branch) => branch.id) || [],
      status: plan?.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    },
  });
  const cancel = href(
    plan ? `/admin/membership-plans/${plan.id}` : '/admin/membership-plans',
  );
  return (
    <div className="max-w-3xl space-y-6">
      <PlanBack href={href('/admin/membership-plans')} />
      <PlanHeader
        title={plan ? 'Edit Plan' : 'Create Plan'}
        subtitle={`${current?.business.name} · Fields marked * are required.`}
      />
      <Card className="p-5 sm:p-7">
        <form
          noValidate
          onSubmit={handleSubmit(async (values) => {
            try {
              const saved = await mutation.mutateAsync({
                name: values.name,
                description: values.description,
                priceMinor: parseMoneyMinor(values.price),
                durationDays: Number(values.durationDays),
                appliesToAllBranches: values.appliesToAllBranches,
                branchIds: values.appliesToAllBranches ? [] : values.branchIds,
                status: values.status,
              });
              const target = new URL(
                href(`/admin/membership-plans/${saved.id}`),
                window.location.origin,
              );
              target.searchParams.set('notice', plan ? 'updated' : 'created');
              router.push(target.pathname + target.search);
            } catch {
              /* Display mutation error below. */
            }
          })}
        >
          <fieldset disabled={mutation.isPending} className="min-w-0 space-y-7">
            <section className="space-y-4">
              <h2 className="text-sm uppercase tracking-wider text-slate-500">
                Plan information
              </h2>
              <label>
                Plan Name *
                <input
                  aria-label="Plan Name"
                  aria-required="true"
                  aria-invalid={!!errors.name}
                  {...register('name')}
                  maxLength={120}
                />
                {errors.name && (
                  <span role="alert" className="text-xs text-red-700">
                    {errors.name.message}
                  </span>
                )}
              </label>
              <label>
                Description (optional)
                <textarea
                  aria-label="Description (optional)"
                  {...register('description')}
                  maxLength={2000}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 p-3 text-base"
                />
              </label>
            </section>
            <section className="space-y-4">
              <h2 className="text-sm uppercase tracking-wider text-slate-500">
                Pricing
              </h2>
              <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                <label>
                  Price *
                  <input
                    aria-label="Price"
                    aria-required="true"
                    aria-invalid={!!errors.price}
                    {...register('price')}
                    inputMode="decimal"
                    placeholder="1200.00"
                    maxLength={16}
                  />
                  {errors.price && (
                    <span role="alert" className="text-xs text-red-700">
                      {errors.price.message}
                    </span>
                  )}
                </label>
                <label>
                  Currency
                  <input
                    aria-label="Currency"
                    value={current?.business.currency || ''}
                    readOnly
                    className="bg-slate-50"
                  />
                </label>
              </div>
            </section>
            <section className="space-y-3">
              <h2 className="text-sm uppercase tracking-wider text-slate-500">
                Duration
              </h2>
              <label>
                Duration in Days *
                <input
                  aria-label="Duration in Days"
                  aria-required="true"
                  aria-invalid={!!errors.durationDays}
                  {...register('durationDays')}
                  inputMode="numeric"
                  maxLength={4}
                />
                {errors.durationDays && (
                  <span role="alert" className="text-xs text-red-700">
                    {errors.durationDays.message}
                  </span>
                )}
              </label>
              <div className="flex flex-wrap gap-2">
                {[30, 90, 180, 365].map((days) => (
                  <button
                    className="bg-slate-100 px-3 py-2 text-slate-600"
                    key={days}
                    type="button"
                    onClick={() =>
                      setValue('durationDays', String(days), {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                  >
                    {days} Days
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                Use 1–3650 calendar days.
              </p>
            </section>
            <BranchApplicabilitySelector
              control={control}
              branches={current?.business.branches || []}
              retained={plan?.branches.map((branch) => branch.id) || []}
            />
            <section className="space-y-3">
              <label>
                Status
                <select aria-label="Status" {...register('status')}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </label>
              <p className="text-xs text-slate-500">
                Active plans are available for new memberships. Inactive plans
                are temporarily unavailable.
              </p>
            </section>
          </fieldset>
          {mutation.error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {mutation.error.message}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">
            {mutation.isPending ? (
              <button disabled type="button">
                Cancel
              </button>
            ) : (
              <Link
                className="button bg-white text-slate-700 ring-1 ring-slate-200"
                href={cancel}
              >
                Cancel
              </Link>
            )}
            <button disabled={mutation.isPending} type="submit">
              {mutation.isPending
                ? 'Saving…'
                : plan
                  ? 'Save Changes'
                  : 'Create Plan'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
export function CreatePlanView() {
  const { current } = useAdminContext();
  return current ? <PlanForm key={current.businessId} /> : <PlanLoading />;
}
export function EditPlanView({ id }: { id: string }) {
  const query = useMembershipPlan(id);
  const { href } = useAdminContext();
  if (query.isPending) return <PlanLoading />;
  if (query.error)
    return <PlanError error={query.error} retry={() => void query.refetch()} />;
  if (query.data.status === 'ARCHIVED')
    return (
      <Card className="space-y-4 p-6">
        <h1>Archived plan</h1>
        <p>Archived plans are read-only.</p>
        <Link
          className="text-blue-700"
          href={href(`/admin/membership-plans/${id}`)}
        >
          View plan
        </Link>
      </Card>
    );
  return <PlanForm key={`${query.data.businessId}:${id}`} plan={query.data} />;
}
