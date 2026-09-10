'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { StaffDetail } from '@gym/types';
import { Card } from '@/components/ui/card';
import { useAdminContext } from '@/features/admin/admin-context';
import { staffSchema, type StaffFormValues } from './staff-schema';
import { useStaffMember, useStaffMutation } from './use-staff';
import { BranchAssignmentSelector } from './branch-assignment-selector';
import {
  StaffBack,
  StaffError,
  StaffHeader,
  StaffLoading,
} from './staff-shared';
const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base';
function Field({
  label,
  error,
  required,
  children,
  wide = false,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? 'sm:col-span-2' : ''}>
      {label}
      {required ? ' *' : ' (optional)'}
      {children}
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </label>
  );
}
function StaffForm({ staff }: { staff?: StaffDetail }) {
  const { current, href, branchId } = useAdminContext();
  const router = useRouter();
  const mutation = useStaffMutation(staff ? 'update' : 'create', staff?.id);
  const assigned = new Set(staff?.branches.map((branch) => branch.id) || []);
  const activeBranches =
    current?.business.branches.filter((branch) => branch.status === 'ACTIVE') ||
    [];
  const archivedAssigned =
    current?.business.branches.filter(
      (branch) => branch.status === 'ARCHIVED' && assigned.has(branch.id),
    ) || [];
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      fullName: staff?.fullName || '',
      phone: staff?.phone || '',
      email: staff?.email || '',
      jobTitle: staff?.jobTitle || '',
      gender: staff?.gender || '',
      dateOfBirth: staff?.dateOfBirth || '',
      joiningDate: staff?.joiningDate || new Date().toISOString().slice(0, 10),
      address: staff?.address || '',
      emergencyContactName: staff?.emergencyContactName || '',
      emergencyContactPhone: staff?.emergencyContactPhone || '',
      status: staff?.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      notes: staff?.notes || '',
      branchIds:
        staff?.branches.map((branch) => branch.id) ||
        (branchId ? [branchId] : []),
    },
  });
  const cancel = href(staff ? `/admin/staff/${staff.id}` : '/admin/staff');
  return (
    <div className="max-w-4xl space-y-6">
      <StaffBack href={href('/admin/staff')} />
      <StaffHeader
        title={staff ? 'Edit Staff' : 'Add Staff'}
        subtitle={`${current?.business.name} · Staff employment records do not grant Admin login access.`}
      />
      <Card className="p-5 sm:p-7">
        <form
          noValidate
          onSubmit={handleSubmit(async (values) => {
            try {
              const saved = await mutation.mutateAsync(values);
              const target = new URL(
                href(`/admin/staff/${saved.id}`),
                window.location.origin,
              );
              target.searchParams.set('notice', staff ? 'updated' : 'created');
              router.push(target.pathname + target.search);
            } catch {
              /* Rendered below. */
            }
          })}
        >
          <fieldset disabled={mutation.isPending} className="space-y-7">
            <section>
              <h2 className="mb-4 text-sm uppercase tracking-wider text-slate-500">
                Personal details
              </h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Full Name"
                  required
                  error={errors.fullName?.message}
                >
                  <input
                    aria-label="Full Name"
                    {...register('fullName')}
                    maxLength={120}
                  />
                </Field>
                <Field label="Phone" required error={errors.phone?.message}>
                  <input
                    aria-label="Phone"
                    {...register('phone')}
                    type="tel"
                    maxLength={32}
                  />
                </Field>
                <Field label="Email" error={errors.email?.message}>
                  <input
                    aria-label="Email (optional)"
                    {...register('email')}
                    type="email"
                    maxLength={254}
                  />
                </Field>
                <Field label="Gender" error={errors.gender?.message}>
                  <select
                    aria-label="Gender (optional)"
                    {...register('gender')}
                  >
                    <option value="">Prefer not to specify</option>
                    <option>Female</option>
                    <option>Male</option>
                    <option>Non-binary</option>
                    <option>Other</option>
                  </select>
                </Field>
                <Field
                  label="Date of Birth"
                  error={errors.dateOfBirth?.message}
                >
                  <input
                    aria-label="Date of Birth (optional)"
                    {...register('dateOfBirth')}
                    type="date"
                  />
                </Field>
              </div>
            </section>
            <section>
              <h2 className="mb-4 text-sm uppercase tracking-wider text-slate-500">
                Employment
              </h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Job Title"
                  required
                  error={errors.jobTitle?.message}
                >
                  <input
                    aria-label="Job Title"
                    {...register('jobTitle')}
                    list="job-titles"
                    maxLength={100}
                  />
                  <datalist id="job-titles">
                    <option value="Manager" />
                    <option value="Trainer" />
                    <option value="Receptionist" />
                    <option value="Personal Trainer" />
                    <option value="Housekeeping" />
                    <option value="Accountant" />
                    <option value="Other" />
                  </datalist>
                </Field>
                <Field
                  label="Joining Date"
                  required
                  error={errors.joiningDate?.message}
                >
                  <input
                    aria-label="Joining Date"
                    {...register('joiningDate')}
                    type="date"
                  />
                </Field>
                <Field label="Status" required error={errors.status?.message}>
                  <select aria-label="Status" {...register('status')}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <BranchAssignmentSelector
                    control={control}
                    active={activeBranches}
                    retained={archivedAssigned}
                  />
                </div>
              </div>
            </section>
            <section>
              <h2 className="mb-4 text-sm uppercase tracking-wider text-slate-500">
                Additional
              </h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Address" error={errors.address?.message} wide>
                  <textarea
                    aria-label="Address (optional)"
                    {...register('address')}
                    maxLength={500}
                    rows={3}
                    className={inputClass}
                  />
                </Field>
                <Field
                  label="Emergency Contact Name"
                  error={errors.emergencyContactName?.message}
                >
                  <input
                    aria-label="Emergency Contact Name (optional)"
                    {...register('emergencyContactName')}
                    maxLength={120}
                  />
                </Field>
                <Field
                  label="Emergency Contact Phone"
                  error={errors.emergencyContactPhone?.message}
                >
                  <input
                    aria-label="Emergency Contact Phone (optional)"
                    {...register('emergencyContactPhone')}
                    type="tel"
                    maxLength={32}
                  />
                </Field>
                <Field label="Notes" error={errors.notes?.message} wide>
                  <textarea
                    aria-label="Notes (optional)"
                    {...register('notes')}
                    maxLength={2000}
                    rows={4}
                    className={inputClass}
                  />
                </Field>
              </div>
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
          <div className="flex flex-wrap justify-end gap-3 border-t pt-5">
            {mutation.isPending ? (
              <button type="button" disabled>
                Cancel
              </button>
            ) : (
              <Link
                href={cancel}
                className="button bg-white text-slate-700 ring-1 ring-slate-200"
              >
                Cancel
              </Link>
            )}
            <button
              type="submit"
              disabled={
                mutation.isPending ||
                (!activeBranches.length && !archivedAssigned.length)
              }
            >
              {mutation.isPending
                ? 'Saving…'
                : staff
                  ? 'Save Changes'
                  : 'Create Staff'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
export function CreateStaffView() {
  const { current } = useAdminContext();
  return current ? <StaffForm key={current.businessId} /> : <StaffLoading />;
}
export function EditStaffView({ id }: { id: string }) {
  const query = useStaffMember(id);
  const { href } = useAdminContext();
  if (query.isPending) return <StaffLoading />;
  if (query.error)
    return (
      <StaffError error={query.error} retry={() => void query.refetch()} />
    );
  if (query.data.status === 'ARCHIVED')
    return (
      <Card className="space-y-4 p-6">
        <h1>Archived staff record</h1>
        <p>Archived staff records are read-only.</p>
        <Link className="text-blue-700" href={href(`/admin/staff/${id}`)}>
          View staff
        </Link>
      </Card>
    );
  return (
    <StaffForm key={`${query.data.businessId}:${id}`} staff={query.data} />
  );
}
