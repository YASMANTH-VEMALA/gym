'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  StaffDetail,
  StaffInput,
  StaffList,
  StaffRecord,
} from '@gym/types';
import { api } from '@/lib/api/auth-api';
import { useAdminContext } from '@/features/admin/admin-context';
export function useStaffList(filters: Record<string, string>) {
  const { current } = useAdminContext();
  return useQuery({
    queryKey: ['staff', current?.businessId, filters],
    enabled: !!current,
    retry: false,
    queryFn: () =>
      api<StaffList>(
        `/businesses/${current!.businessId}/staff?${new URLSearchParams(filters)}`,
      ),
  });
}
export function useStaffMember(id: string) {
  const { current } = useAdminContext();
  return useQuery({
    queryKey: ['staff-member', current?.businessId, id],
    enabled: !!current && !!id,
    retry: false,
    queryFn: () =>
      api<StaffDetail>(`/businesses/${current!.businessId}/staff/${id}`),
  });
}
export function useStaffMutation(
  operation: 'create' | 'update' | 'archive',
  id?: string,
) {
  const { current } = useAdminContext();
  const client = useQueryClient();
  const businessId = current?.businessId;
  return useMutation({
    mutationFn: (input: StaffInput | Record<string, never>) => {
      if (!businessId) throw new Error('Select a business to continue.');
      return api<StaffRecord>(
        `/businesses/${businessId}/staff${operation === 'create' ? '' : `/${id}${operation === 'archive' ? '/archive' : ''}`}`,
        input,
        operation === 'update' ? 'PATCH' : undefined,
      );
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['staff', businessId] }),
        client.invalidateQueries({ queryKey: ['staff-member', businessId] }),
        client.invalidateQueries({ queryKey: ['branches', businessId] }),
        client.invalidateQueries({ queryKey: ['branch', businessId] }),
        client.invalidateQueries({ queryKey: ['dashboard', businessId] }),
      ]);
    },
  });
}
