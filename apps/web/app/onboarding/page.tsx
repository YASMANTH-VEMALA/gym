'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type BusinessAccess, inviteStorageKey } from '@/lib/api/auth-api';
import { AuthPanel } from '@/components/auth-panel';
export default function Onboarding() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (sessionStorage.getItem(inviteStorageKey)) {
      location.replace('/invite');
      return;
    }
    void api<BusinessAccess[]>('/me/businesses')
      .then((access) => {
        if (access.length) location.replace('/admin');
        else setReady(true);
      })
      .catch(() => setMessage('Unable to load your account. Reload to retry.'));
  }, []);
  return (
    <AuthPanel
      title="Set up your gym"
      description="Create your business and first branch to get started."
    >
      {ready && (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const values = Object.fromEntries(
              new FormData(event.currentTarget),
            );
            setBusy(true);
            setMessage('');
            try {
              await api('/onboarding', values);
              router.replace('/admin');
              router.refresh();
            } catch (error) {
              setMessage(
                error instanceof Error
                  ? error.message
                  : 'Unable to create your gym',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Business name
            <input name="name" required maxLength={100} />
          </label>
          <label>
            First branch name
            <input name="branchName" required maxLength={100} />
          </label>
          <label>
            Currency
            <select name="currency" defaultValue="INR">
              {['INR', 'USD', 'EUR', 'GBP', 'AED'].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Timezone
            <input
              name="timezone"
              defaultValue="Asia/Kolkata"
              required
              list="timezones"
            />
            <datalist id="timezones">
              {[
                'Asia/Kolkata',
                'UTC',
                'America/New_York',
                'Europe/London',
                'Asia/Dubai',
              ].map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </label>
          <button disabled={busy}>{busy ? 'Creating…' : 'Create gym'}</button>
        </form>
      )}
      {!ready && !message && <p>Loading account…</p>}
      {message && (
        <p role="alert" className="error">
          {message}
        </p>
      )}
    </AuthPanel>
  );
}
