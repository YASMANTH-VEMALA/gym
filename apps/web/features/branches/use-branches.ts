'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BranchDetail,
  BranchInput,
  BranchList,
  BranchRecord,
} from '@gym/types';
import { api } from '@/lib/api/auth-api';
import { useAdminContext } from '@/features/admin/admin-context';

export function useBranches(filters: {
  search: string;
  status: string;
  page: number;
}) {
  const { current } = useAdminContext();
  return useQuery({
    queryKey: ['branches', current?.businessId, filters],
    enabled: !!current,
    retry: false,
    queryFn: () =>
      api<BranchList>(
        `/businesses/${current!.businessId}/branches?${new URLSearchParams({ ...filters, page: String(filters.page) })}`,
      ),
  });
}
export function useBranch(id: string) {
  const { current } = useAdminContext();
  return useQuery({
    queryKey: ['branch', current?.businessId, id],
    enabled: !!current && !!id,
    retry: false,
    queryFn: () =>
      api<BranchDetail>(`/businesses/${current!.businessId}/branches/${id}`),
  });
}
export function useBranchMutation(
  operation: 'create' | 'update' | 'archive',
  id?: string,
) {
  const { current } = useAdminContext();
  const client = useQueryClient();
  const businessId = current?.businessId;
  return useMutation({
    mutationFn: (input: BranchInput | Record<string, never>) => {
      if (!businessId) throw new Error('Select a business to continue.');
      return api<BranchRecord>(
        `/businesses/${businessId}/branches${operation === 'create' ? '' : `/${id}${operation === 'archive' ? '/archive' : ''}`}`,
        input,
        operation === 'update' ? 'PATCH' : undefined,
      );
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['branches', businessId] }),
        client.invalidateQueries({ queryKey: ['branch', businessId] }),
        client.invalidateQueries({ queryKey: ['businesses'] }),
        client.invalidateQueries({ queryKey: ['dashboard', businessId] }),
        client.invalidateQueries({ queryKey: ['staff', businessId] }),
        client.invalidateQueries({ queryKey: ['staff-member', businessId] }),
        client.invalidateQueries({
          queryKey: ['membership-plans', businessId],
        }),
        client.invalidateQueries({ queryKey: ['membership-plan', businessId] }),
      ]);
    },
  });
}
