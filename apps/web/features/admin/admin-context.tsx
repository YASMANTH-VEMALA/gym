'use client';
import {
  createContext,
  useContext,
  useEffect,
  useTransition,
  type ReactNode,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { BusinessAccess } from '@/lib/api/auth-api';
import { inviteStorageKey, api } from '@/lib/api/auth-api';
import { useBusinessAccess } from './use-business-access';

interface AdminContextValue {
  current?: BusinessAccess;
  businesses: BusinessAccess[];
  branchId?: string;
  pending: boolean;
  error: Error | null;
  invalidBusiness: boolean;
  retry: () => void;
  selectBusiness: (id: string) => void;
  selectBranch: (id: string) => void;
  href: (path: string) => string;
}
const AdminContext = createContext<AdminContextValue | null>(null);
export function AdminProvider({ children }: { children: ReactNode }) {
  const access = useBusinessAccess();
  const [switching, startSwitch] = useTransition();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = params.get('businessId');
  const current = requested
    ? access.data?.find((item) => item.businessId === requested)
    : access.data?.[0];
  const requestedBranch = params.get('branchId') || undefined;
  const invalidBranchSelection =
    !!requestedBranch &&
    !!current &&
    !current.business.branches.some(
      (branch) => branch.id === requestedBranch && branch.status === 'ACTIVE',
    );
  const branchId = invalidBranchSelection ? undefined : requestedBranch;
  useEffect(() => {
    if (!invalidBranchSelection) return;
    const query = new URLSearchParams(params.toString());
    query.delete('branchId');
    router.replace(`${pathname}?${query}`, { scroll: false });
  }, [invalidBranchSelection, params, pathname, router]);
  useEffect(() => {
    if (sessionStorage.getItem(inviteStorageKey)) router.replace('/invite');
    else if (access.data?.length === 0) {
      let active = true;
      void api<unknown[]>('/member/links')
        .then((links) => {
          if (active) router.replace(links.length ? '/member' : '/onboarding');
        })
        .catch(() => {
          /* Stay at the recoverable access boundary while the API is unavailable. */
        });
      return () => {
        active = false;
      };
    }
  }, [access.data, router]);
  function href(path: string) {
    const query = new URLSearchParams();
    if (current) query.set('businessId', current.businessId);
    if (branchId) query.set('branchId', branchId);
    return query.size ? `${path}?${query}` : path;
  }
  return (
    <AdminContext.Provider
      value={{
        current,
        businesses: access.data || [],
        branchId,
        pending: access.isPending || switching,
        error: access.error,
        invalidBusiness: !!requested && !!access.data?.length && !current,
        retry: () => {
          void access.refetch();
        },
        href,
        selectBusiness: (id) => {
          const query = new URLSearchParams(params.toString());
          query.set('businessId', id);
          query.delete('branchId');
          query.delete('page');
          query.delete('memberId');
          query.delete('membershipId');
          query.delete('notice');
          const detail = pathname.match(
            /^\/admin\/(branches|staff|membership-plans|members|memberships)\/[^/]+/,
          );
          const target = detail ? `/admin/${detail[1]}` : pathname;
          startSwitch(() =>
            router.replace(`${target}?${query}`, { scroll: false }),
          );
        },
        selectBranch: (id) => {
          const query = new URLSearchParams(params.toString());
          query.delete('page');
          query.delete('notice');
          if (current) query.set('businessId', current.businessId);
          if (id) query.set('branchId', id);
          else query.delete('branchId');
          const detail = pathname.match(
            /^\/admin\/(members|memberships|staff|membership-plans)\/[^/]+/,
          );
          startSwitch(() =>
            router.replace(
              `${detail ? `/admin/${detail[1]}` : pathname}?${query}`,
              { scroll: false },
            ),
          );
        },
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}
export function useAdminContext() {
  const context = useContext(AdminContext);
  if (!context) throw new Error('AdminProvider is required');
  return context;
}
