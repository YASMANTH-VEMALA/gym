export const oauthDestinationCookie = 'gym.oauth-next';

const allowedDestinations = new Set([
  '/admin',
  '/invite',
  '/q/member',
  '/member',
  '/member/link',
  '/join',
]);

export function authDestination(value?: string | null) {
  if (!value) return '/admin';

  try {
    const decoded = decodeURIComponent(value);
    return allowedDestinations.has(decoded) ? decoded : '/admin';
  } catch {
    return '/admin';
  }
}
