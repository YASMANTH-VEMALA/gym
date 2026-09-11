'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { MemberDetail } from '@gym/types';
import {
  calendarToday,
  fitnessGoals,
  normalizeMemberPhone,
  parseWeightGrams,
} from '@gym/validation';
import { Card } from '@/components/ui/card';
import { useAdminContext } from '@/features/admin/admin-context';
import { useMember, useMemberMutation } from './use-members';
import { memberSchema, type MemberFormValues } from './member-schema';
import {
  MemberAvatar,
  MemberBack,
  MemberError,
  MemberHeader,
  MemberLoading,
} from './member-shared';

function MemberForm({ member }: { member?: MemberDetail }) {
  const { current, branchId, isBranchLocked, href } = useAdminContext();
  const router = useRouter();
  const mutation = useMemberMutation(member ? 'update' : 'create', member?.id);
  const timezone = current?.business.timezone || 'Asia/Kolkata';
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema(timezone)),
    defaultValues: {
      branchId: member
        ? member.branchId || ''
        : isBranchLocked && current?.assignedBranchId
          ? current.assignedBranchId
          : branchId || '',
      fullName: member?.fullName || '',
      phone: member?.phone || '',
      joiningDate: member?.joiningDate || calendarToday(timezone),
      alternatePhone: member?.alternatePhone || '',
      email: member?.email || '',
      gender: member?.gender || '',
      dateOfBirth: member?.dateOfBirth || '',
      occupation: member?.occupation || '',
      addressLine1: member?.addressLine1 || '',
      addressLine2: member?.addressLine2 || '',
      city: member?.city || '',
      state: member?.state || '',
      postalCode: member?.postalCode || '',
      country: member?.country || '',
      emergencyContacts: member?.emergencyContacts?.length
        ? member.emergencyContacts.map((contact) => ({
            name: contact.name,
            phone: contact.phone,
            relationship: contact.relationship || '',
          }))
        : member?.emergencyContactName && member.emergencyContactPhone
          ? [
              {
                name: member.emergencyContactName,
                phone: member.emergencyContactPhone,
                relationship: member.emergencyContactRelationship || '',
              },
            ]
          : [],
      profilePhotoDataUrl: member?.profilePhotoDataUrl || '',
      heightCm: member?.heightCm ? String(member.heightCm) : '',
      weightKg: member?.weightGrams
        ? `${Math.floor(member.weightGrams / 1000)}.${String(member.weightGrams % 1000).padStart(3, '0')}`
        : '',
      fitnessGoal: (member?.fitnessGoal ||
        '') as MemberFormValues['fitnessGoal'],
      notes: member?.notes || '',
      status: member?.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    },
  });
  const contacts = useFieldArray({ control, name: 'emergencyContacts' });
  const profilePhotoDataUrl = useWatch({
    control,
    name: 'profilePhotoDataUrl',
  });
  const field = (
    name: keyof MemberFormValues,
    label: string,
    options: { type?: string; required?: boolean; maxLength?: number } = {},
  ) => (
    <label key={name}>
      {label}
      {options.required ? ' *' : ' (optional)'}
      <input
        aria-label={label}
        aria-required={options.required}
        aria-invalid={!!errors[name]}
        type={options.type || 'text'}
        maxLength={options.maxLength || 200}
        {...register(name)}
      />
      {errors[name] && (
        <span role="alert" className="text-xs text-red-700">
          {errors[name]?.message}
        </span>
      )}
    </label>
  );
  return (
    <div className="max-w-4xl space-y-6">
      <MemberBack href={href('/admin/members')} />
      <MemberHeader
        title={member ? 'Edit Member' : 'Add Member'}
        subtitle={`${current?.business.name} · Fields marked * are required.`}
      />
      <Card className="p-5 sm:p-7">
        <form
          noValidate
          onSubmit={handleSubmit(async (values) => {
            const { weightKg, heightCm, profilePhotoDataUrl, ...data } = values;
            try {
              const saved = await mutation.mutateAsync({
                ...data,
                branchId: data.branchId || null,
                phone: normalizeMemberPhone(data.phone),
                emergencyContacts: data.emergencyContacts.map((contact) => ({
                  ...contact,
                  phone: normalizeMemberPhone(contact.phone),
                })),
                profilePhotoDataUrl: profilePhotoDataUrl || null,
                heightCm: heightCm ? Number(heightCm) : null,
                weightGrams: weightKg ? parseWeightGrams(weightKg) : null,
              });
              const target = new URL(
                href(`/admin/members/${saved.id}`),
                window.location.origin,
              );
              target.searchParams.set('notice', member ? 'updated' : 'created');
              router.push(target.pathname + target.search);
            } catch {
              /* Mutation error preserves entered values. */
            }
          })}
        >
          <fieldset disabled={mutation.isPending} className="min-w-0 space-y-6">
            <section className="space-y-4">
              <h2>Personal Information</h2>
              <div className="flex items-center gap-3">
                <MemberAvatar
                  name={member?.fullName || '?'}
                  photoDataUrl={profilePhotoDataUrl}
                />
                <div className="space-y-2">
                  <input
                    aria-label="Profile photo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      clearErrors('profilePhotoDataUrl');
                      if (!file) return;
                      if (
                        !['image/jpeg', 'image/png', 'image/webp'].includes(
                          file.type,
                        ) ||
                        file.size > 1.5 * 1024 * 1024
                      ) {
                        event.target.value = '';
                        setError('profilePhotoDataUrl', {
                          message:
                            'Choose a JPEG, PNG, or WebP image up to 1.5 MB.',
                        });
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () =>
                        setValue('profilePhotoDataUrl', String(reader.result), {
                          shouldDirty: true,
                        });
                      reader.readAsDataURL(file);
                    }}
                  />
                  <p className="text-xs text-slate-500">
                    JPEG, PNG, or WebP up to 1.5 MB.
                  </p>
                  {profilePhotoDataUrl && (
                    <button
                      className="secondary"
                      type="button"
                      onClick={() =>
                        setValue('profilePhotoDataUrl', '', {
                          shouldDirty: true,
                        })
                      }
                    >
                      Remove photo
                    </button>
                  )}
                  {errors.profilePhotoDataUrl && (
                    <span role="alert" className="text-xs text-red-700">
                      {errors.profilePhotoDataUrl.message}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  Registration branch
                  <select
                    aria-label="Registration branch"
                    {...register('branchId')}
                  >
                    {!isBranchLocked && <option value="">Unassigned</option>}
                    {current?.business.branches
                      .filter(
                        (b) =>
                          b.status === 'ACTIVE' || b.id === member?.branchId,
                      )
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                          {b.status === 'ARCHIVED' ? ' (archived)' : ''}
                        </option>
                      ))}
                  </select>
                  {errors.branchId && (
                    <span role="alert">{errors.branchId.message}</span>
                  )}
                </label>
                {field('fullName', 'Full Name', {
                  required: true,
                  maxLength: 120,
                })}
                {field('phone', 'Mobile Number', {
                  required: true,
                  type: 'tel',
                  maxLength: 32,
                })}
                {field('joiningDate', 'Joining Date', {
                  required: true,
                  type: 'date',
                })}
              </div>
            </section>
            <details
              className="rounded-lg border border-slate-200 p-4"
              open={member ? true : undefined}
            >
              <summary className="cursor-pointer font-medium">
                More personal details
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {field('alternatePhone', 'Alternate Mobile', {
                  type: 'tel',
                  maxLength: 32,
                })}
                {field('email', 'Email', { type: 'email', maxLength: 254 })}
                {field('gender', 'Gender', { maxLength: 50 })}
                {field('dateOfBirth', 'Date of Birth', { type: 'date' })}
                {field('occupation', 'Occupation', { maxLength: 120 })}
              </div>
            </details>
            <details className="rounded-lg border border-slate-200 p-4">
              <summary className="cursor-pointer font-medium">Address</summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {field('addressLine1', 'Address Line 1')}
                {field('addressLine2', 'Address Line 2')}
                {field('city', 'City', { maxLength: 100 })}
                {field('state', 'State', { maxLength: 100 })}
                {field('postalCode', 'PIN / Postal Code', { maxLength: 20 })}
                {field('country', 'Country', { maxLength: 100 })}
              </div>
            </details>
            <details className="rounded-lg border border-slate-200 p-4" open>
              <summary className="cursor-pointer font-medium">
                Emergency Contacts
              </summary>
              <div className="mt-4 space-y-4">
                {contacts.fields.map((contact, index) => (
                  <div
                    className="grid gap-4 rounded-lg border border-slate-200 p-4 sm:grid-cols-2"
                    key={contact.id}
                  >
                    <label>
                      Contact Name *
                      <input
                        maxLength={120}
                        {...register(`emergencyContacts.${index}.name`)}
                      />
                      {errors.emergencyContacts?.[index]?.name && (
                        <span role="alert">
                          {errors.emergencyContacts[index].name.message}
                        </span>
                      )}
                    </label>
                    <label>
                      Contact Number *
                      <input
                        type="tel"
                        maxLength={32}
                        {...register(`emergencyContacts.${index}.phone`)}
                      />
                      {errors.emergencyContacts?.[index]?.phone && (
                        <span role="alert">
                          {errors.emergencyContacts[index].phone.message}
                        </span>
                      )}
                    </label>
                    <label>
                      Relationship (optional)
                      <input
                        maxLength={80}
                        {...register(`emergencyContacts.${index}.relationship`)}
                      />
                    </label>
                    <div className="flex items-end">
                      <button
                        className="secondary"
                        type="button"
                        onClick={() => contacts.remove(index)}
                      >
                        Remove contact
                      </button>
                    </div>
                  </div>
                ))}
                {contacts.fields.length < 5 && (
                  <button
                    className="secondary"
                    type="button"
                    onClick={() =>
                      contacts.append({ name: '', phone: '', relationship: '' })
                    }
                  >
                    Add emergency contact
                  </button>
                )}
              </div>
            </details>
            <details className="rounded-lg border border-slate-200 p-4">
              <summary className="cursor-pointer font-medium">
                Fitness Details
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {field('heightCm', 'Height (cm)', { maxLength: 3 })}
                {field('weightKg', 'Weight (kg)', { maxLength: 8 })}
                <label>
                  Fitness Goal (optional)
                  <select
                    aria-label="Fitness Goal"
                    {...register('fitnessGoal')}
                  >
                    <option value="">Select a goal</option>
                    {fitnessGoals.map((goal) => (
                      <option key={goal}>{goal}</option>
                    ))}
                  </select>
                </label>
              </div>
            </details>
            <section className="space-y-4">
              <h2>Additional</h2>
              <label>
                Notes (optional)
                <textarea
                  aria-label="Notes"
                  maxLength={2000}
                  rows={3}
                  {...register('notes')}
                />
                {errors.notes && (
                  <span role="alert">{errors.notes.message}</span>
                )}
              </label>
              <label>
                Status
                <select aria-label="Status" {...register('status')}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </label>
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
          {Object.keys(errors).length > 0 && (
            <p className="text-sm text-red-700">
              Please review the highlighted fields, including optional sections.
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
                href={href(
                  member ? `/admin/members/${member.id}` : '/admin/members',
                )}
              >
                Cancel
              </Link>
            )}
            <button disabled={mutation.isPending} type="submit">
              {mutation.isPending
                ? 'Saving…'
                : member
                  ? 'Save Changes'
                  : 'Create Member'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
export function CreateMemberView() {
  const { current, branchId } = useAdminContext();
  return current ? (
    <MemberForm key={`${current.businessId}:${branchId || ''}`} />
  ) : (
    <MemberLoading />
  );
}
export function EditMemberView({ id }: { id: string }) {
  const query = useMember(id);
  const { href } = useAdminContext();
  if (query.isPending) return <MemberLoading />;
  if (query.error)
    return (
      <MemberError error={query.error} retry={() => void query.refetch()} />
    );
  if (query.data.status === 'ARCHIVED')
    return (
      <Card className="space-y-4 p-6">
        <h1>Archived member</h1>
        <p>Archived members are read-only.</p>
        <Link href={href(`/admin/members/${id}`)}>View member</Link>
      </Card>
    );
  return (
    <MemberForm key={`${query.data.businessId}:${id}`} member={query.data} />
  );
}
