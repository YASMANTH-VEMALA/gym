'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  MemberDetail,
  MemberInput,
  MemberList,
  MemberRecord,
} from '@gym/types';
import { api } from '@/lib/api/auth-api';
import { useAdminContext } from '@/features/admin/admin-context';
export function useMembers(filters: Record<string, string>) {
  const { current } = useAdminContext();
  return useQuery({
    queryKey: ['members', current?.businessId, filters],
    enabled: !!current,
    retry: false,
    queryFn: () =>
      api<MemberList>(
        `/businesses/${current!.businessId}/members?${new URLSearchParams(filters)}`,
      ),
  });
}
export function useMember(id: string) {
  const { current } = useAdminContext();
  return useQuery({
    queryKey: ['member', current?.businessId, id],
    enabled: !!current && !!id,
    retry: false,
    queryFn: () =>
      api<MemberDetail>(`/businesses/${current!.businessId}/members/${id}`),
  });
}
export function useMemberMutation(
  operation: 'create' | 'update' | 'archive',
  id?: string,
) {
  const { current } = useAdminContext();
  const client = useQueryClient();
  const businessId = current?.businessId;
  return useMutation({
    mutationFn: (input: MemberInput | Record<string, never>) => {
      if (!businessId) throw new Error('Select a business to continue.');
      return api<MemberRecord>(
        `/businesses/${businessId}/members${operation === 'create' ? '' : `/${id}${operation === 'archive' ? '/archive' : ''}`}`,
        input,
        operation === 'update' ? 'PATCH' : undefined,
      );
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({
          queryKey: ['members', businessId],
        }),
        client.invalidateQueries({ queryKey: ['member', businessId] }),
        client.invalidateQueries({ queryKey: ['dashboard', businessId] }),
        client.invalidateQueries({ queryKey: ['branches', businessId] }),
        client.invalidateQueries({ queryKey: ['branch', businessId] }),
        client.invalidateQueries({ queryKey: ['product', businessId] }),
      ]);
    },
  });
}
