'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/auth-api';
import { useAdminContext } from '@/features/admin/admin-context';
export function useBusinessQuery<T>(
  path: string,
  filters: Record<string, string> = {},
) {
  const { current } = useAdminContext();
  return useQuery({
    queryKey: ['product', current?.businessId, path, filters],
    enabled: !!current,
    retry: false,
    queryFn: () =>
      api<T>(
        `/businesses/${current!.businessId}/${path}?${new URLSearchParams(filters)}`,
      ),
  });
}
export function useBusinessAction<T = unknown>() {
  const { current } = useAdminContext();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      path,
      body,
      method,
    }: {
      path: string;
      body: unknown;
      method?: 'PATCH';
    }) => api<T>(`/businesses/${current!.businessId}/${path}`, body, method),
    onSuccess: () => client.invalidateQueries(),
  });
}
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface MembershipRecord {
  id: string;
  memberId: string;
  branchId: string;
  planId: string;
  planNameSnapshot: string;
  priceMinorSnapshot: number;
  durationDaysSnapshot: number;
  startDate: string;
  endDate: string;
  status: string;
  cancelReason: string | null;
  member: { id: string; fullName: string; memberNumber: string };
  branch: { id: string; name: string };
  business: { currency: string; timezone: string };
}
