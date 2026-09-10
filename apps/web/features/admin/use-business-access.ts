'use client';
import { useQuery } from '@tanstack/react-query';
import { api, type BusinessAccess } from '@/lib/api/auth-api';
import { browserAuth } from '@/lib/supabase/client';
export function useBusinessAccess() {
  return useQuery({
    queryKey: ['businesses'],
    queryFn: () => api<BusinessAccess[]>('/me/businesses'),
    retry: false,
  });
}
export function useAccountProfile() {
  return useQuery({
    queryKey: ['account-profile'],
    queryFn: async () => {
      const { data, error } = await browserAuth().auth.getUser();
      if (error) throw new Error('Unable to load account details');
      const meta = data.user?.user_metadata;
      const name =
        typeof meta?.full_name === 'string'
          ? meta.full_name
          : typeof meta?.name === 'string'
            ? meta.name
            : '';
      return { name, email: data.user?.email || '' };
    },
    retry: false,
    staleTime: 60_000,
  });
}
