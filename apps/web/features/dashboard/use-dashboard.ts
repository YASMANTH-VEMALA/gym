'use client';
import { useQuery } from '@tanstack/react-query';
import type { DashboardResponse } from '@gym/types';
import { api } from '@/lib/api/auth-api';
import { useAdminContext } from '@/features/admin/admin-context';
export function useDashboard() {
  const { current, branchId } = useAdminContext();
  return useQuery({
    queryKey: ['dashboard', current?.businessId, branchId || 'all'],
    queryFn: () =>
      api<DashboardResponse>(
        `/businesses/${current!.businessId}/dashboard${branchId ? `?${new URLSearchParams({ branchId })}` : ''}`,
      ),
    enabled: !!current,
    retry: false,
  });
}
