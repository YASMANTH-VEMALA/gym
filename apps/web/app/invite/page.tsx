'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserAuth } from '@/lib/supabase/client';
import { api, inviteStorageKey } from '@/lib/api/auth-api';
import { AuthPanel } from '@/components/auth-panel';
export default function Invite() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const incoming = new URLSearchParams(location.hash.slice(1)).get('token');
    history.replaceState(null, '', '/invite');
    if (incoming) sessionStorage.setItem(inviteStorageKey, incoming);
    async function load() {
      try {
        const { data, error } = await browserAuth().auth.getUser();
        setToken(sessionStorage.getItem(inviteStorageKey) || '');
        if (!error) setEmail(data.user?.email || '');
      } catch {
        setMessage('Authentication is unavailable. Please retry.');
      } finally {
        setReady(true);
      }
    }
    void load();
  }, []);
  return (
    <AuthPanel
      title="Join your gym team"
      description="Accept this invitation using the verified email address it was sent to."
    >
      {!ready ? (
        <p>Loading invitation…</p>
      ) : !token ? (
        <p role="alert">
          No invitation found. Open the link in your invitation email.
        </p>
      ) : !email ? (
        <a className="button" href="/sign-in?next=/invite">
          Sign in to continue
        </a>
      ) : (
        <>
          <p>
            Signed in as <strong>{email}</strong>
          </p>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setMessage('');
              try {
                await api('/invitations/accept', { token });
                sessionStorage.removeItem(inviteStorageKey);
                router.replace('/admin');
                router.refresh();
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : 'Unable to accept invitation. Please retry.',
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Accept Admin invitation
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const { error } = await browserAuth().auth.signOut({
                  scope: 'local',
                });
                if (error) throw error;
                router.replace('/sign-in?next=/invite');
                router.refresh();
              } catch {
                setMessage('Unable to sign out. Please retry.');
                setBusy(false);
              }
            }}
          >
            Sign out and use another account
          </button>
        </>
      )}
      <button
        className="secondary"
        disabled={busy}
        onClick={() => {
          sessionStorage.removeItem(inviteStorageKey);
          router.replace('/admin');
          router.refresh();
        }}
      >
        Cancel invitation
      </button>
      {message && (
        <p className="error" role="alert">
          {message}
        </p>
      )}
    </AuthPanel>
  );
}
