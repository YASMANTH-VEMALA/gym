import { NextRequest, NextResponse } from 'next/server';
import { serverAuth } from '@/lib/supabase/server';
export async function GET(request: NextRequest) {
  const origin = process.env.WEB_ORIGIN || 'http://localhost:3000';
  const code = request.nextUrl.searchParams.get('code');
  const next =
    ['/invite','/q/member','/member','/member/link','/join'].includes(request.nextUrl.searchParams.get('next') || '')
      ? request.nextUrl.searchParams.get('next')!
      : '/admin';
  if (code) {
    try {
      const auth = await serverAuth();
      const { error } = await auth.auth.exchangeCodeForSession(code);
      if (!error)
        return NextResponse.redirect(new URL(next, origin), {
          headers: { 'Cache-Control': 'no-store' },
        });
    } catch {
      /* Show a recoverable error without exposing OAuth details. */
    }
  }
  return NextResponse.redirect(
    new URL(`${['/member','/member/link','/join'].includes(next)?'/member/sign-in':'/sign-in'}?error=oauth&next=${encodeURIComponent(next)}`, origin),
  );
}
