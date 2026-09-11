'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronsUpDown, Building2 } from 'lucide-react';
import { useAdminContext } from '@/features/admin/admin-context';
import { resolveLogoUrl } from '@/lib/api/auth-api';
import { cn } from '@/lib/utils';
import { navigation } from './admin-navigation';

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const {
    current,
    businesses,
    selectBusiness,
    href,
    hasPermission,
    isBranchLocked,
    assignedBranchName,
  } = useAdminContext();
  const logoUrl = resolveLogoUrl(current?.business.logoUrl);

  const filteredNav = navigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasPermission(item.section)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      <Link
        href={href('/admin/dashboard')}
        onClick={onNavigate}
        className="flex h-[72px] shrink-0 items-center gap-3 border-b border-slate-100 px-5"
      >
        {logoUrl ? (
          <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-0.5 shadow-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
          </span>
        ) : (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white">
            <span className="text-sm font-semibold" aria-hidden="true">
              {current?.business.name.slice(0, 1).toUpperCase() || 'G'}
            </span>
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-slate-950 leading-tight">
            {current?.business.name || 'Gym'}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span
              className="inline-flex items-center text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500"
            >
              {current?.role || 'Staff'}
            </span>
          </div>
        </div>
      </Link>

      {isBranchLocked && assignedBranchName && (
        <div className="mx-3 mb-2 rounded-lg border border-purple-200/60 bg-purple-50/60 p-2.5 text-xs text-purple-900">
          <p className="flex items-center gap-1.5 font-semibold text-[11px]">
            <Building2 size={13} aria-hidden="true" />
            Branch Scoped
          </p>
          <p className="mt-0.5 truncate text-[11px] text-purple-700">
            {assignedBranchName}
          </p>
        </div>
      )}

      <nav
        aria-label="Admin navigation"
        className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-5"
      >
        {filteredNav.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const basePath = item.path.split('?')[0]!;
                const active =
                  pathname === basePath ||
                  (basePath !== '/admin/dashboard' &&
                    basePath !== '/admin/attendance' &&
                    pathname.startsWith(`${basePath}/`));
                return (
                  <li key={item.path}>
                    <Link
                      href={href(item.path)}
                      aria-current={active ? 'page' : undefined}
                      onClick={onNavigate}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950',
                        active &&
                          'bg-slate-100 font-semibold text-slate-950 hover:bg-slate-100 hover:text-slate-950',
                      )}
                    >
                      <item.icon
                        size={17}
                        strokeWidth={active ? 2.1 : 1.8}
                        className={cn(active ? 'text-slate-950' : 'text-slate-400')}
                        aria-hidden="true"
                      />
                      <span className="truncate">{item.label}</span>
                      {active && <span className="ml-auto h-4 w-0.5 rounded-full bg-slate-950" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {businesses.length > 1 && (
        <div className="shrink-0 border-t border-slate-100 p-3">
          <label className="relative mt-3 block">
            <span className="sr-only">Business</span>
            <select
              aria-label="Business"
              className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-1 pr-7 text-xs font-medium text-slate-700 shadow-2xs"
              value={current?.businessId || ''}
              onChange={(event) => selectBusiness(event.target.value)}
            >
              {!current && (
                <option value="" disabled>
                  Choose a business
                </option>
              )}
              {businesses.map((item) => (
                <option key={item.businessId} value={item.businessId}>
                  {item.business.name}
                </option>
              ))}
            </select>
            <ChevronsUpDown
              className="pointer-events-none absolute right-2 top-2.5 text-slate-500"
              size={14}
              aria-hidden="true"
            />
          </label>
        </div>
      )}
    </>
  );
}
