'use client';
import Link from 'next/link';
import { Notifications } from '@/features/dashboard/notifications';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Bell, ChevronDown, LogOut, MapPin, Settings2 } from 'lucide-react';
import { useAdminContext } from '@/features/admin/admin-context';
import { useAccountProfile } from '@/features/admin/use-business-access';
import { browserAuth } from '@/lib/supabase/client';
import { resolveLogoUrl } from '@/lib/api/auth-api';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { pageTitle } from './admin-navigation';
import type { ReactNode } from 'react';
export function AdminTopbar({ mobileTrigger }: { mobileTrigger: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const cache = useQueryClient();
  const { current, branchId, isBranchLocked, assignedBranchName, selectBranch, href } = useAdminContext();
  const logoUrl = resolveLogoUrl(current?.business.logoUrl);
  const profile = useAccountProfile();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const unavailable =
    !!branchId &&
    !current?.business.branches.some((branch) => branch.id === branchId);
  return (
    <>
      <header className="sticky top-0 z-20 flex min-h-[72px] flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-7">
        <div className="flex items-center gap-3">
          {mobileTrigger}
          {logoUrl ? (
            <div className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-0.5 sm:hidden shadow-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt=""
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : null}
          <p className="text-sm font-medium text-slate-600">
            {pageTitle(pathname)}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          {isBranchLocked ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50/80 px-3 py-2 text-xs font-semibold text-purple-900 shadow-2xs">
              <MapPin size={14} className="text-purple-700" />
              <span className="truncate max-w-[140px] sm:max-w-[200px]">{assignedBranchName || 'My Branch'}</span>
            </div>
          ) : (
            <label className="relative">
              <span className="sr-only">Branch</span>
              <MapPin
                className="pointer-events-none absolute left-3 top-3 text-slate-500"
                size={15}
                aria-hidden="true"
              />
              <select
                aria-label="Branch"
                className="h-9 w-36 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-7 text-xs font-medium text-slate-700 shadow-none sm:w-44"
                value={branchId || ''}
                disabled={!current}
                onChange={(event) => selectBranch(event.target.value)}
              >
                <option value="">All Branches</option>
                {unavailable && (
                  <option value={branchId} disabled>
                    Unavailable branch
                  </option>
                )}
                {current?.business.branches
                  .filter((branch) => branch.status === 'ACTIVE')
                  .map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Notifications"
                className="rounded-lg bg-transparent p-2 text-slate-500"
              >
                <Bell size={19} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <Notifications />
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Open profile menu"
                className="gap-2 rounded-full bg-transparent p-0.5 text-slate-600"
              >
                <span className="flex size-9 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-xs font-semibold text-blue-700">
                  {(profile.data?.name || profile.data?.email || 'U')
                    .slice(0, 1)
                    .toUpperCase()}
                </span>
                <ChevronDown
                  size={14}
                  aria-hidden="true"
                  className="hidden sm:block"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="block max-w-[min(20rem,85vw)] px-3 py-2">
                <span className="block truncate font-semibold">
                  {profile.data?.name || 'Your account'}
                </span>
                <span className="mt-1 block truncate text-xs font-normal text-slate-500">
                  {profile.data?.email ||
                    (profile.isPending
                      ? 'Loading account…'
                      : 'Email unavailable')}
                </span>
                <span className="mt-2 block text-xs font-medium capitalize text-blue-700">
                  {current?.role.toLowerCase()}
                </span>
              </DropdownMenuLabel>
              {profile.error && (
                <DropdownMenuItem
                  onSelect={() => {
                    void profile.refetch();
                  }}
                >
                  Retry account details
                </DropdownMenuItem>
              )}
              {current?.role === 'OWNER' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={href('/admin/settings/access')}>
                      <Settings2 size={15} aria-hidden="true" />
                      Access management
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={busy}
                onSelect={async () => {
                  setBusy(true);
                  setError('');
                  try {
                    const { error } = await browserAuth().auth.signOut({
                      scope: 'local',
                    });
                    if (error) throw error;
                    cache.clear();
                    router.replace('/sign-in');
                    router.refresh();
                  } catch {
                    setError('Unable to sign out. Please try again.');
                    setBusy(false);
                  }
                }}
              >
                <LogOut size={15} aria-hidden="true" />
                {busy ? 'Signing out…' : 'Sign out'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      {error && (
        <p role="alert" className="error m-4">
          {error}
        </p>
      )}
    </>
  );
}
