'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  MembershipPlanDetail,
  MembershipPlanInput,
  MembershipPlanList,
  MembershipPlanRecord,
} from '@gym/types';
import { api } from '@/lib/api/auth-api';
import { useAdminContext } from '@/features/admin/admin-context';
export function useMembershipPlans(filters: Record<string, string>) {
  const { current } = useAdminContext();
  return useQuery({
    queryKey: ['membership-plans', current?.businessId, filters],
    enabled: !!current,
    retry: false,
    queryFn: () =>
      api<MembershipPlanList>(
        `/businesses/${current!.businessId}/membership-plans?${new URLSearchParams(filters)}`,
      ),
  });
}
export function useMembershipPlan(id: string) {
  const { current } = useAdminContext();
  return useQuery({
    queryKey: ['membership-plan', current?.businessId, id],
    enabled: !!current && !!id,
    retry: false,
    queryFn: () =>
      api<MembershipPlanDetail>(
        `/businesses/${current!.businessId}/membership-plans/${id}`,
      ),
  });
}
export function useMembershipPlanMutation(
  operation: 'create' | 'update' | 'archive',
  id?: string,
) {
  const { current } = useAdminContext();
  const client = useQueryClient();
  const businessId = current?.businessId;
  return useMutation({
    mutationFn: (input: MembershipPlanInput | Record<string, never>) => {
      if (!businessId) throw new Error('Select a business to continue.');
      return api<MembershipPlanRecord>(
        `/businesses/${businessId}/membership-plans${operation === 'create' ? '' : `/${id}${operation === 'archive' ? '/archive' : ''}`}`,
        input,
        operation === 'update' ? 'PATCH' : undefined,
      );
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({
          queryKey: ['membership-plans', businessId],
        }),
        client.invalidateQueries({ queryKey: ['membership-plan', businessId] }),
        client.invalidateQueries({ queryKey: ['dashboard', businessId] }),
      ]);
    },
  });
}
