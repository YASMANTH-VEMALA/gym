'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useFragmentCredential } from '@/features/qr/fragment';
import { AuthPanel } from '@/components/auth-panel';
import { browserAuth } from '@/lib/supabase/client';
import { api } from '@/lib/api/auth-api';
export default function Page() {
  const router = useRouter(),
    cache = useQueryClient();
  const { token, ready, clear } = useFragmentCredential(
      'gym.member-invitation',
    ),
    [error, setError] = useState('');
  const account = useQuery({
    queryKey: ['member-invitation-account'],
    retry: false,
    queryFn: async () => {
      const { data } = await browserAuth().auth.getSession();
      if (!data.session) return null;
      const user = await browserAuth().auth.getUser();
      if (user.error)
        throw new Error('Unable to verify your account. Please retry.');
      return user.data.user;
    },
  });
  const accept = useMutation({
    mutationFn: () =>
      api<{ memberId: string }>('/member/invitations/accept', { token }),
    onSuccess: (data) => {
      clear();
      cache.removeQueries({ queryKey: ['member-links'] });
      router.push(`/member?memberId=${data.memberId}`);
    },
  });
  return (
    <AuthPanel
      member
      title="Connect your member profile"
      description="Use the verified email address that received this invitation. This grants member access only."
    >
      {!ready || account.isPending ? (
        <p>Loading invitation…</p>
      ) : !token ? (
        <p>
          No invitation found. Open the link in your gym’s invitation email.
        </p>
      ) : account.error ? (
        <>
          <p role="alert">{account.error.message}</p>
          <button onClick={() => void account.refetch()}>Retry</button>
        </>
      ) : !account.data ? (
        <Link className="button" href="/member/sign-in?next=%2Fmember%2Flink">
          Sign in to continue
        </Link>
      ) : (
        <>
          <p>
            Signed in as <strong>{account.data.email}</strong>
          </p>
          <button disabled={accept.isPending} onClick={() => accept.mutate()}>
            Accept member invitation
          </button>
          <button
            className="secondary"
            disabled={accept.isPending}
            onClick={async () => {
              setError('');
              const { error } = await browserAuth().auth.signOut({
                scope: 'local',
              });
              if (error) setError('Unable to sign out. Please retry.');
              else {
                cache.clear();
                router.push('/member/sign-in?next=%2Fmember%2Flink');
              }
            }}
          >
            Sign out and use another account
          </button>
        </>
      )}
      {(accept.error || error) && (
        <p role="alert" className="error">
          {accept.error?.message || error}
        </p>
      )}
      {token && (
        <button
          className="secondary"
          disabled={accept.isPending}
          onClick={() => {
            clear();
            router.push('/member');
          }}
        >
          Cancel invitation
        </button>
      )}
    </AuthPanel>
  );
}
