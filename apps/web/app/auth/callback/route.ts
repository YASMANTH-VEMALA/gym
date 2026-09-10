import { NextRequest, NextResponse } from 'next/server';
import { serverAuth } from '@/lib/supabase/server';
import { authDestination, oauthDestinationCookie } from '@/lib/auth-redirect';

function redirect(request: NextRequest, path: string) {
  const origin = process.env.WEB_ORIGIN || request.nextUrl.origin;
  const response = NextResponse.redirect(new URL(path, origin), {
    headers: { 'Cache-Control': 'no-store' },
  });
  response.cookies.set(oauthDestinationCookie, '', {
    path: '/auth/callback',
    maxAge: 0,
    sameSite: 'lax',
    secure: origin.startsWith('https://'),
  });
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const next = authDestination(
    request.cookies.get(oauthDestinationCookie)?.value ||
      request.nextUrl.searchParams.get('next'),
  );
  if (code) {
    try {
      const auth = await serverAuth();
      const { error } = await auth.auth.exchangeCodeForSession(code);
      if (!error) return redirect(request, next);
    } catch {
      /* Show a recoverable error without exposing OAuth details. */
    }
  }
  return redirect(
    request,
    `${['/member','/member/link','/join'].includes(next)?'/member/sign-in':'/sign-in'}?error=oauth&next=${encodeURIComponent(next)}`,
  );
}
