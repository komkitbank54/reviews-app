import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({}));
  if (!process.env.ADMIN_PASSWORD) {
    return new NextResponse('ADMIN_PASSWORD not set', { status: 500 });
  }
  if (password !== process.env.ADMIN_PASSWORD) {
    return new NextResponse('Invalid password', { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  // เซ็ตคุกกี้ session
  res.cookies.set('admin_session', 'ok', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12, // 12 ชม.
  });
  return res;
}
