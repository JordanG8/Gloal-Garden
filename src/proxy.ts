import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from '@/i18n/config';

/**
 * Locale negotiation: every app path lives under /en or /he. Requests without
 * a locale prefix (including "/") are redirected to the visitor's preferred
 * locale — cookie first, then Accept-Language, then English.
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasLocale = /^\/(en|he)(\/|$)/.test(pathname);
  if (hasLocale) return NextResponse.next();

  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  let locale = isLocale(cookieLocale) ? cookieLocale : undefined;
  if (!locale) {
    const accept = request.headers.get('accept-language') ?? '';
    locale = /(^|,|;|\s)he\b/i.test(accept) ? 'he' : DEFAULT_LOCALE;
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except API routes, Next internals, and files with extensions.
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
