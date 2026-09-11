import { browserAuth } from '@/lib/supabase/client';
export interface BusinessAccess {
  businessId: string;
  role: 'OWNER' | 'ADMIN' | 'MANAGER';
  assignedBranchId?: string | null;
  permissions?: string[] | null;
  assignedBranch?: { id: string; name: string; status: 'ACTIVE' | 'ARCHIVED' } | null;
  business: {
    id: string;
    name: string;
    currency: string;
    timezone: string;
    logoUrl?: string | null;
    googleSheetId?: string | null;
    branches: { id: string; name: string; status: 'ACTIVE' | 'ARCHIVED' }[];
  };
}

export function resolveLogoUrl(url?: string | null): string | null {
  if (!url) return null;
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:')
  ) {
    return url;
  }
  const apiOrigin = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  return `${apiOrigin}${url.startsWith('/') ? '' : '/'}${url}`;
}
export interface Invitation {
  id: string;
  email: string;
  role?: string;
  assignedBranchId?: string | null;
  assignedBranch?: { id: string; name: string } | null;
  permissions?: string[] | null;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  deliveryStatus: string;
}
export interface TeamMember {
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MANAGER';
  assignedBranchId: string | null;
  assignedBranchName: string | null;
  permissions: string[];
  email: string | null;
}
export async function api<T>(
  path: string,
  body?: unknown,
  method?: 'PATCH' | 'PUT' | 'DELETE',
): Promise<T> {
  const { data, error } = await browserAuth().auth.getSession();
  if (error || !data.session) {
    // Reload at the authentication boundary to discard cached account data.
    const member=window.location.pathname.startsWith('/member') || window.location.pathname==='/join';
    window.location.assign(new URL(member?'/member/sign-in':'/sign-in', window.location.origin).href);
    throw new Error('Your session has expired. Sign in to continue.');
  }
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1${path}`,
    {
      method: method || (body === undefined ? 'GET' : 'POST'),
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: 'no-store',
    },
  );
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(
      Array.isArray(result.message)
        ? result.message.join('. ')
        : result.message || 'Request failed. Please retry.',
    );
  }
  return response.json();
}
export const inviteStorageKey = 'gym.pending-invitation';
