'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ChangeEvent } from 'react';
import {
  useFragmentCredential,
  branchQrStorage,
  resolvePublicBranch,
} from '@/features/qr/fragment';
import { AuthPanel } from '@/components/auth-panel';
import { browserAuth } from '@/lib/supabase/client';
import { api } from '@/lib/api/auth-api';

type EmergencyContact = { name: string; phone: string; relationship: string };
const emptyContact = (): EmergencyContact => ({
  name: '',
  phone: '',
  relationship: '',
});

function ageFromDate(value: string) {
  if (!value) return null;
  const birth = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birth.valueOf())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  )
    age -= 1;
  return age >= 0 ? age : null;
}

async function readPhoto(file?: File) {
  if (!file) return '';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Choose a JPEG, PNG, or WebP image.');
  if (file.size > 1.5 * 1024 * 1024)
    throw new Error('Profile photo must be 1.5 MB or smaller.');
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Unable to read this photo.'));
    reader.readAsDataURL(file);
  });
}

export default function Page() {
  const router = useRouter();
  const cache = useQueryClient();
  const { token, ready, version, clear } =
    useFragmentCredential(branchQrStorage);
  const [fullName, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [dateOfBirth, setDob] = useState('');
  const [addressLine1, setAddress] = useState('');
  const [contacts, setContacts] = useState<EmergencyContact[]>([
    emptyContact(),
  ]);
  const [profilePhotoDataUrl, setPhoto] = useState('');
  const [photoError, setPhotoError] = useState('');
  const age = ageFromDate(dateOfBirth);
  const branch = useQuery({
    queryKey: ['branch-join', version],
    enabled: !!token,
    retry: false,
    queryFn: () => resolvePublicBranch(token!),
  });
  const account = useQuery({
    queryKey: ['registration-account'],
    retry: false,
    queryFn: async () => {
      const { data } = await browserAuth().auth.getSession();
      if (!data.session) return null;
      const user = await browserAuth().auth.getUser();
      if (user.error)
        throw new Error(
          'Unable to verify your session. Retry or sign in again.',
        );
      return user.data.user;
    },
  });
  const registerMember = useMutation({
    mutationFn: () =>
      api<{ memberId: string }>('/member/register', {
        token,
        fullName,
        phone,
        gender,
        dateOfBirth,
        addressLine1,
        emergencyContacts: contacts.map(
          ({ name, phone: contactPhone, relationship }) => ({
            name,
            phone: contactPhone,
            ...(relationship ? { relationship } : {}),
          }),
        ),
        ...(profilePhotoDataUrl ? { profilePhotoDataUrl } : {}),
      }),
    onSuccess: (data) => {
      clear();
      cache.removeQueries({ queryKey: ['member-links'] });
      router.push(`/member?memberId=${data.memberId}`);
    },
  });
  const updateContact = (
    index: number,
    key: keyof EmergencyContact,
    value: string,
  ) =>
    setContacts((current) =>
      current.map((contact, contactIndex) =>
        contactIndex === index ? { ...contact, [key]: value } : contact,
      ),
    );
  const selectPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    setPhotoError('');
    try {
      setPhoto(await readPhoto(event.target.files?.[0]));
    } catch (error) {
      event.target.value = '';
      setPhoto('');
      setPhotoError(error instanceof Error ? error.message : 'Invalid photo.');
    }
  };

  return (
    <AuthPanel
      member
      title="Join your gym"
      description="Register through your gym's branch QR code."
    >
      {!ready || (token && branch.isPending) ? (
        <p>Loading registration…</p>
      ) : !token ? (
        <p>No registration code is available. Scan your gym’s branch QR.</p>
      ) : branch.error ? (
        <>
          <p role="alert">{branch.error.message}</p>
          <button onClick={() => void branch.refetch()}>Retry</button>
        </>
      ) : branch.data ? (
        <>
          <h2>{branch.data.businessName}</h2>
          <div className="grid gap-3 rounded-lg bg-blue-50 p-4 text-sm sm:grid-cols-2">
            <div>
              <span className="text-slate-500">Registration branch</span>
              <strong className="block">{branch.data.branchName}</strong>
            </div>
            <div>
              <span className="text-slate-500">Joining date</span>
              <strong className="block">{branch.data.joiningDate}</strong>
            </div>
          </div>
          {account.isPending ? (
            <p>Checking your account…</p>
          ) : account.error ? (
            <>
              <p role="alert">{account.error.message}</p>
              <button onClick={() => void account.refetch()}>
                Retry account
              </button>
            </>
          ) : !account.data ? (
            <>
              <p>
                Verify your email to create and securely access your member
                profile.
              </p>
              <Link className="button" href="/member/sign-in?next=%2Fjoin">
                Sign in to register
              </Link>
            </>
          ) : (
            <>
              <p>
                Signed in as <strong>{account.data.email}</strong>
              </p>
              <p className="text-sm text-slate-500">
                Already registered with this gym? Ask staff for a profile-link
                invitation to avoid creating a duplicate. Registration does not
                purchase or assign a membership.
              </p>
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  registerMember.mutate();
                }}
              >
                <fieldset
                  disabled={registerMember.isPending}
                  className="space-y-5"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label>
                      Full name *
                      <input
                        required
                        maxLength={120}
                        autoComplete="name"
                        value={fullName}
                        onChange={(event) => setName(event.target.value)}
                      />
                    </label>
                    <label>
                      Mobile number *
                      <input
                        required
                        maxLength={30}
                        type="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                      />
                    </label>
                    <label>
                      Gender *
                      <select
                        required
                        value={gender}
                        onChange={(event) => setGender(event.target.value)}
                      >
                        <option value="">Select gender</option>
                        <option>Female</option>
                        <option>Male</option>
                        <option>Non-binary</option>
                        <option>Prefer not to say</option>
                        <option>Other</option>
                      </select>
                    </label>
                    <label>
                      Date of birth *
                      <input
                        required
                        type="date"
                        max={new Date().toISOString().slice(0, 10)}
                        value={dateOfBirth}
                        onChange={(event) => setDob(event.target.value)}
                      />
                      {age !== null && (
                        <span className="text-xs text-slate-500">
                          Age: {age}
                        </span>
                      )}
                    </label>
                  </div>
                  <label>
                    Address *
                    <textarea
                      required
                      rows={3}
                      maxLength={500}
                      autoComplete="street-address"
                      value={addressLine1}
                      onChange={(event) => setAddress(event.target.value)}
                    />
                  </label>
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3>Emergency contacts *</h3>
                      {contacts.length < 5 && (
                        <button
                          type="button"
                          className="secondary"
                          onClick={() =>
                            setContacts((current) => [
                              ...current,
                              emptyContact(),
                            ])
                          }
                        >
                          Add contact
                        </button>
                      )}
                    </div>
                    {contacts.map((contact, index) => (
                      <div
                        className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2"
                        key={index}
                      >
                        <label>
                          Contact name *
                          <input
                            required
                            maxLength={120}
                            value={contact.name}
                            onChange={(event) =>
                              updateContact(index, 'name', event.target.value)
                            }
                          />
                        </label>
                        <label>
                          Contact number *
                          <input
                            required
                            type="tel"
                            maxLength={32}
                            value={contact.phone}
                            onChange={(event) =>
                              updateContact(index, 'phone', event.target.value)
                            }
                          />
                        </label>
                        <label>
                          Relationship (optional)
                          <input
                            maxLength={80}
                            value={contact.relationship}
                            onChange={(event) =>
                              updateContact(
                                index,
                                'relationship',
                                event.target.value,
                              )
                            }
                          />
                        </label>
                        {contacts.length > 1 && (
                          <div className="flex items-end">
                            <button
                              type="button"
                              className="secondary"
                              onClick={() =>
                                setContacts((current) =>
                                  current.filter(
                                    (_, contactIndex) => contactIndex !== index,
                                  ),
                                )
                              }
                            >
                              Remove contact
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </section>
                  <section className="space-y-3">
                    <label>
                      Profile photo (optional)
                      <input
                        aria-label="Profile photo"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => void selectPhoto(event)}
                      />
                      <span className="text-xs text-slate-500">
                        JPEG, PNG, or WebP up to 1.5 MB.
                      </span>
                    </label>
                    {profilePhotoDataUrl && (
                      <div className="flex items-center gap-3">
                        <Image
                          className="size-20 rounded-full object-cover"
                          src={profilePhotoDataUrl}
                          alt="Profile preview"
                          width={80}
                          height={80}
                          unoptimized
                        />
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => setPhoto('')}
                        >
                          Remove photo
                        </button>
                      </div>
                    )}
                    {photoError && (
                      <p role="alert" className="error">
                        {photoError}
                      </p>
                    )}
                  </section>
                  <button disabled={!!photoError}>Create member profile</button>
                </fieldset>
                {registerMember.error && (
                  <p role="alert" className="error">
                    {registerMember.error.message}
                  </p>
                )}
              </form>
              <button
                className="secondary"
                disabled={registerMember.isPending}
                onClick={async () => {
                  const { error } = await browserAuth().auth.signOut({
                    scope: 'local',
                  });
                  if (!error) {
                    cache.clear();
                    router.push('/member/sign-in?next=%2Fjoin');
                  }
                }}
              >
                Use another account
              </button>
            </>
          )}
        </>
      ) : null}
      {token && (
        <button
          className="secondary"
          disabled={registerMember.isPending}
          onClick={clear}
        >
          Cancel registration
        </button>
      )}
    </AuthPanel>
  );
}
