import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  const { data, error } = await supabase.auth.getClaims();
  if (
    (error || !data?.claims) &&
    (['/admin', '/onboarding'].some((path) =>
      request.nextUrl.pathname.startsWith(path),
    ) || (request.nextUrl.pathname.startsWith('/member') && !['/member/sign-in','/member/link'].includes(request.nextUrl.pathname)))
  ) {
    const redirect = NextResponse.redirect(
      new URL(request.nextUrl.pathname.startsWith('/member')?'/member/sign-in':'/sign-in', process.env.WEB_ORIGIN || request.nextUrl.origin),
    );
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    redirect.headers.set('Cache-Control', 'private, no-store');
    return redirect;
  }
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = {
  matcher: ['/admin/:path*', '/onboarding', '/sign-in', '/invite','/member/:path*','/join','/q/member'],
};
