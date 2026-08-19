import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresca la sesión si el access token caducó; las cookies renovadas
  // quedan en supabaseResponse vía setAll
  const { data } = await supabase.auth.getClaims();

  const { pathname, searchParams } = request.nextUrl;
  // only same-origin relative paths, never protocol-relative (`//host`)
  const nextParam = searchParams.get('next');
  const safeNext =
    nextParam?.startsWith('/') && !nextParam.startsWith('//')
      ? nextParam
      : null;

  if (data?.claims && pathname === '/auth') {
    const redirect = NextResponse.redirect(
      new URL(safeNext ?? '/', request.url),
    );
    supabaseResponse.cookies
      .getAll()
      .forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  if (!data?.claims && /^\/games\/[^/]+\/play$/.test(pathname)) {
    const authUrl = new URL('/auth', request.url);
    authUrl.searchParams.set('reason', 'play');
    authUrl.searchParams.set('next', pathname);
    const redirect = NextResponse.redirect(authUrl);
    supabaseResponse.cookies
      .getAll()
      .forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3)$).*)',
  ],
};
