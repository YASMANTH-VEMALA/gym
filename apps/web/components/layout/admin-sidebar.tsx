'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dumbbell, ChevronsUpDown } from 'lucide-react';
import { useAdminContext } from '@/features/admin/admin-context';
import { cn } from '@/lib/utils';
import { navigation } from './admin-navigation';
export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { current, businesses, selectBusiness, href } = useAdminContext();
  return (
    <>
      <Link
        href={href('/admin/dashboard')}
        onClick={onNavigate}
        className="flex h-[76px] shrink-0 items-center gap-3 px-6"
      >
        <span className="flex size-9 items-center justify-center rounded-xl bg-blue-700 text-white">
          <Dumbbell size={21} aria-hidden="true" />
        </span>
        <span className="text-lg font-bold tracking-tight text-slate-900">
          Gym<span className="font-normal text-slate-500"> workspace</span>
        </span>
      </Link>
      <nav
        aria-label="Admin navigation"
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-5"
      >
        {navigation.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.path ||
                  pathname.startsWith(`${item.path}/`);
                return (
                  <li key={item.path}>
                    <Link
                      href={href(item.path)}
                      aria-current={active ? 'page' : undefined}
                      onClick={onNavigate}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950',
                        active &&
                          'bg-blue-50 text-blue-700 hover:bg-blue-50 hover:text-blue-700',
                      )}
                    >
                      <item.icon
                        size={17}
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                      {item.label}
                      {active && (
                        <span className="ml-auto size-1.5 rounded-full bg-blue-600" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="shrink-0 border-t border-slate-100 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-600"
            aria-hidden="true"
          >
            {current?.business.name.slice(0, 1).toUpperCase() || 'G'}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-xs font-semibold text-slate-800"
              title={current?.business.name}
            >
              {current?.business.name || 'Your gym'}
            </p>
            <p className="mt-0.5 text-xs capitalize text-slate-500">
              {current?.role.toLowerCase() || 'Workspace'}
            </p>
          </div>
        </div>
        {businesses.length > 1 && (
          <label className="relative mt-3">
            <span className="sr-only">Business</span>
            <select
              aria-label="Business"
              className="h-9 appearance-none rounded-lg border-slate-200 py-1 pr-7 text-xs"
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
        )}
      </div>
    </>
  );
}
