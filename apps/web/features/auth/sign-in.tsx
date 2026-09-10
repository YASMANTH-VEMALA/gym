'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { browserAuth } from '@/lib/supabase/client';
import { inviteStorageKey } from '@/lib/api/auth-api';
import { AuthPanel } from '@/components/auth-panel';
function SignInContent({memberMode=false}:{memberMode?:boolean}) {
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  function destination() {
    if(memberMode){const next=new URLSearchParams(location.search).get('next');return sessionStorage.getItem('gym.member-invitation') || next==='/member/link'?'/member/link':sessionStorage.getItem('gym.branch-registration') || next==='/join'?'/join':'/member';}
    return sessionStorage.getItem(inviteStorageKey) ||
      new URLSearchParams(location.search).get('next') === '/invite'
      ? '/invite'
      : new URLSearchParams(location.search).get('next') === '/q/member' ? '/q/member' : '/admin';
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to sign in. Please retry.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    await run(async () => {
      const { error } = await browserAuth().auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      });
      if (error)
        throw new Error(
          'Unable to send a code. Check your email address and try again shortly.',
        );
      setSent(true);
      setCooldown(60);
    });
  }
  return (
    <AuthPanel
      member={memberMode}
      title="Welcome to your gym"
      description={memberMode?'Sign in to view your membership, payments and gym profile.':'Sign in to manage your business and team.'}
    >
      <button
        className="secondary"
        disabled={busy}
        onClick={() =>
          run(async () => {
            const redirect = new URL('/auth/callback', location.origin);
            redirect.searchParams.set('next', destination());
            const { error } = await browserAuth().auth.signInWithOAuth({
              provider: 'google',
              options: { redirectTo: redirect.href },
            });
            if (error)
              throw new Error('Google sign-in is unavailable. Please retry.');
          })
        }
      >
        Continue with Google
      </button>
      <div className="divider">or use your email</div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!sent) void send();
          else
            void run(async () => {
              const { error } = await browserAuth().auth.verifyOtp({
                email: email.trim(),
                token: code.trim(),
                type: 'email',
              });
              if (error)
                throw new Error(
                  'This code is invalid or expired. Try again or request a new code.',
                );
              location.assign(destination());
            });
        }}
      >
        <label>
          Email address
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            disabled={sent || busy}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {sent && (
          <>
            <p className="muted">Enter the code sent to {email}.</p>
            <label>
              Verification code
              <input
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6,10}"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
          </>
        )}
        <button disabled={busy}>
          {busy
            ? 'Please wait…'
            : sent
              ? 'Verify and continue'
              : 'Send sign-in code'}
        </button>
      </form>
      {sent && (
        <div className="actions">
          <button
            className="secondary"
            disabled={busy || cooldown > 0}
            onClick={send}
          >
            {cooldown ? `Resend in ${cooldown}s` : 'Resend code'}
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => {
              setSent(false);
              setCode('');
            }}
          >
            Change email
          </button>
        </div>
      )}
      {(message || params.has('error')) && (
        <p role="alert" className="error">
          {message ||
            'Google sign-in could not be completed. Please try again.'}
        </p>
      )}
    </AuthPanel>
  );
}
export function SignIn({memberMode=false}:{memberMode?:boolean}) {
  return (
    <Suspense fallback={<p>Loading sign-in…</p>}>
      <SignInContent memberMode={memberMode} />
    </Suspense>
  );
}
