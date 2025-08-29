// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ปกป้องเฉพาะหน้า /admin (ไม่ยุ่งกับ /api เลย)
  const isAdminPage = pathname.startsWith('/admin');
  const isLoginPage = pathname.startsWith('/admin/login');
  if (!isAdminPage || isLoginPage) return NextResponse.next();

  const cookie = req.cookies.get('admin_session')?.value;
  if (cookie === 'ok') return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/admin/login';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

// กันเฉพาะเพจ /admin
export const config = {
  matcher: ['/admin/:path*'],
};
