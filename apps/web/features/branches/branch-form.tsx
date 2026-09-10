'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { BranchDetail } from '@gym/types';
import { Card } from '@/components/ui/card';
import { useAdminContext } from '@/features/admin/admin-context';
import { branchSchema, type BranchFormValues } from './branch-schema';
import { useBranch, useBranchMutation } from './use-branches';
import {
  BranchBack,
  BranchError,
  BranchHeader,
  BranchLoading,
} from './branch-shared';

const fields: {
  name: keyof BranchFormValues;
  label: string;
  required?: boolean;
  max: number;
  type?: string;
}[] = [
  { name: 'name', label: 'Branch Name', required: true, max: 100 },
  { name: 'code', label: 'Branch Code', max: 20 },
  { name: 'addressLine1', label: 'Address Line 1', required: true, max: 200 },
  { name: 'addressLine2', label: 'Address Line 2', max: 200 },
  { name: 'city', label: 'City', required: true, max: 100 },
  { name: 'state', label: 'State', required: true, max: 100 },
  { name: 'country', label: 'Country', required: true, max: 100 },
  { name: 'postalCode', label: 'PIN / Postal Code', required: true, max: 20 },
  { name: 'phone', label: 'Phone', max: 32, type: 'tel' },
  { name: 'email', label: 'Email', max: 254, type: 'email' },
  { name: 'timezone', label: 'Timezone override', max: 100 },
];
function BranchForm({ branch }: { branch?: BranchDetail }) {
  const { current, href } = useAdminContext();
  const router = useRouter();
  const mutation = useBranchMutation(branch ? 'update' : 'create', branch?.id);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BranchFormValues>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: branch?.name || '',
      code: branch?.code || '',
      phone: branch?.phone || '',
      email: branch?.email || '',
      addressLine1: branch?.addressLine1 || '',
      addressLine2: branch?.addressLine2 || '',
      city: branch?.city || '',
      state: branch?.state || '',
      country: branch ? branch.country || '' : 'India',
      postalCode: branch?.postalCode || '',
      timezone: branch?.timezone || '',
    },
  });
  const cancel = href(
    branch ? `/admin/branches/${branch.id}` : '/admin/branches',
  );
  return (
    <div className="max-w-3xl space-y-6">
      <BranchBack href={href('/admin/branches')} />
      <BranchHeader
        title={branch ? 'Edit Branch' : 'Create Branch'}
        subtitle={`${current?.business.name} · Fields marked * are required.`}
      />
      <Card className="p-5 sm:p-6">
        <form
          noValidate
          onSubmit={handleSubmit(async (values) => {
            try {
              const saved = await mutation.mutateAsync(values);
              const target = new URL(
                href(`/admin/branches/${saved.id}`),
                window.location.origin,
              );
              target.searchParams.set('notice', branch ? 'updated' : 'created');
              router.push(target.pathname + target.search);
            } catch {
              /* Mutation error is rendered below. */
            }
          })}
        >
          <fieldset
            disabled={mutation.isPending}
            className="grid min-w-0 gap-5 sm:grid-cols-2"
          >
            {fields.map((field) => (
              <label
                key={field.name}
                htmlFor={`branch-${field.name}`}
                className={
                  field.name === 'addressLine1' || field.name === 'addressLine2'
                    ? 'sm:col-span-2'
                    : ''
                }
              >
                {field.label}
                {field.required ? ' *' : ' (optional)'}
                <input
                  id={`branch-${field.name}`}
                  {...register(field.name)}
                  type={field.type || 'text'}
                  aria-label={`${field.label}${field.required ? ' *' : ' (optional)'}`}
                  maxLength={field.max}
                  aria-required={field.required}
                  aria-invalid={!!errors[field.name]}
                  aria-describedby={
                    errors[field.name]
                      ? `${field.name}-error`
                      : field.name === 'code' || field.name === 'timezone'
                        ? `${field.name}-hint`
                        : undefined
                  }
                  placeholder={
                    field.name === 'timezone'
                      ? current?.business.timezone
                      : undefined
                  }
                />
                {field.name === 'code' && (
                  <span
                    id="code-hint"
                    className="text-xs font-normal text-slate-500"
                  >
                    Leave blank to generate a code. Codes are unique within this
                    business.
                  </span>
                )}
                {field.name === 'timezone' && (
                  <span
                    id="timezone-hint"
                    className="text-xs font-normal text-slate-500"
                  >
                    Leave blank to inherit {current?.business.timezone}.
                  </span>
                )}
                {errors[field.name] && (
                  <span
                    id={`${field.name}-error`}
                    role="alert"
                    className="text-xs text-red-700"
                  >
                    {errors[field.name]?.message}
                  </span>
                )}
              </label>
            ))}
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
              <button type="button" disabled>
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
            <button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? 'Saving…'
                : branch
                  ? 'Save Changes'
                  : 'Create Branch'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
export function CreateBranchView() {
  const { current } = useAdminContext();
  return current ? <BranchForm key={current.businessId} /> : <BranchLoading />;
}
export function EditBranchView({ id }: { id: string }) {
  const query = useBranch(id);
  const { href } = useAdminContext();
  if (query.isPending) return <BranchLoading />;
  if (query.error)
    return (
      <BranchError error={query.error} retry={() => void query.refetch()} />
    );
  if (query.data.status === 'ARCHIVED')
    return (
      <Card className="space-y-4 p-6">
        <h1>Archived branch</h1>
        <p>Archived branches are read-only.</p>
        <Link href={href(`/admin/branches/${id}`)} className="text-blue-700">
          View branch
        </Link>
      </Card>
    );
  return (
    <BranchForm key={`${query.data.businessId}:${id}`} branch={query.data} />
  );
}
