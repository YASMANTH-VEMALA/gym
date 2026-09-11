'use client';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Home, IdCard, Wallet, QrCode, User } from 'lucide-react';
import { browserAuth } from '@/lib/supabase/client';
import { resolveLogoUrl } from '@/lib/api/auth-api';
import { MemberProvider, useMemberContext } from './member-context';
function Shell({ children }: { children: ReactNode }) {
  const cache = useQueryClient();
  const { current, links, href } = useMemberContext(),
    pathname = usePathname(),
    router = useRouter();
  const logoUrl = resolveLogoUrl(current.business.logoUrl);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = [
    ['/member', 'Home', Home],
    ['/member/membership', 'Membership', IdCard],
    ['/member/dues', 'Dues & Payments', Wallet],
    ['/member/qr', 'QR', QrCode],
    ['/member/profile', 'Profile', User],
  ] as const;
  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-0.5 shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoUrl}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : null}
            <div>
              <Link
                href={href('/member')}
                className="text-xs font-bold tracking-widest text-blue-700 uppercase"
              >
                Member Portal
              </Link>
              <p className="mt-0.5 font-bold text-slate-900">{current.business.name}</p>
            </div>
          </div>
          <button
            disabled={busy}
            className="bg-slate-100 text-sm text-slate-700"
            onClick={async () => {
              setBusy(true);
              try {
                const { error } = await browserAuth().auth.signOut({
                  scope: 'local',
                });
                if (error) throw error;
                for (const k of [
                  'gym.branch-registration',
                  'gym.member-invitation',
                  'gym.member-scan',
                ])
                  sessionStorage.removeItem(k);
                cache.clear();
                router.push('/member/sign-in');
              } catch {
                setError('Unable to sign out. Please retry.');
                setBusy(false);
              }
            }}
          >
            Sign out
          </button>
          {links.length > 1 && (
            <label className="w-full">
              My gym
              <select
                aria-label="My gym"
                value={current.memberId}
                onChange={(e) =>
                  router.push(`${pathname}?memberId=${e.target.value}`)
                }
              >
                {links.map((l) => (
                  <option key={l.memberId} value={l.memberId}>
                    {l.business.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {error && <p role="alert">{error}</p>}
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-5 p-5">{children}</main>
      <nav
        aria-label="Member navigation"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto grid max-w-3xl grid-cols-5">
          {nav.map(([path, label, Icon]) => (
            <Link
              key={path}
              aria-current={pathname === path ? 'page' : undefined}
              href={href(path)}
              className={`flex flex-col items-center gap-1 px-1 py-3 text-[10px] sm:text-xs ${pathname === path ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-500'}`}
            >
              <Icon size={21} />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
export function MemberFrame({ children }: { children: ReactNode }) {
  const path = usePathname();
  return ['/member/sign-in', '/member/link'].includes(path) ? (
    children
  ) : (
    <MemberProvider>
      <Shell>{children}</Shell>
    </MemberProvider>
  );
}
