'use client';
import { useEffect, useCallback, useSyncExternalStore } from 'react';
const empty = { token: null as string | null, ready: false, version: '' };
const snapshots = new Map<string, typeof empty>();
const credentialEvent = 'gym-credential-change';
export const branchQrStorage = 'gym.branch-registration';
export const memberQrStorage = 'gym.member-scan';
export function useFragmentCredential(storage: string) {
  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener(credentialEvent, notify);
    return () => window.removeEventListener(credentialEvent, notify);
  }, []);
  const getSnapshot = useCallback(
    () => snapshots.get(storage) || empty,
    [storage],
  );
  const state = useSyncExternalStore(subscribe, getSnapshot, () => empty);
  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const incoming = fragment.get('token');
    if (window.location.hash) {
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search,
      );
      if (incoming && /^[A-Za-z0-9_-]{43}$/.test(incoming))
        sessionStorage.setItem(storage, incoming);
      else sessionStorage.removeItem(storage);
    }
    const saved = sessionStorage.getItem(storage);
    snapshots.set(storage, {
      token: saved && /^[A-Za-z0-9_-]{43}$/.test(saved) ? saved : null,
      version: crypto.randomUUID(),
      ready: true,
    });
    window.dispatchEvent(new Event(credentialEvent));
  }, [storage]);
  return {
    ...state,
    clear: () => {
      sessionStorage.removeItem(storage);
      snapshots.set(storage, { ...state, token: null });
      window.dispatchEvent(new Event(credentialEvent));
    },
  };
}
export async function resolvePublicBranch(token: string): Promise<{
  businessName: string;
  businessLogoUrl?: string | null;
  branchName: string;
  joiningDate: string;
}> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/public/qr/branch`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      cache: 'no-store',
    },
  );
  if (!response.ok)
    throw new Error(
      'This registration QR is invalid or unavailable. Ask your gym for a current code, or retry.',
    );
  return response.json();
}
