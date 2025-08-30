import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("u");

  if (!raw) {
    // ไม่มีพารามิเตอร์ u -> กลับหน้าแรก
    return NextResponse.redirect(new URL("/", req.url), 302);
  }

  // ถอดรหัส + ทำให้เป็น URL สมบูรณ์
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {}
  let href = decoded.trim();
  if (!/^https?:\/\//i.test(href)) {
    href = "https://" + href.replace(/^\/+/, "");
  }

  let dest: URL;
  try {
    dest = new URL(href);
  } catch {
    return NextResponse.redirect(new URL("/", req.url), 302);
  }

  // แก้กรณีหน้า coupon ของ TikTok ให้เปิดเป็น land page (อยู่ใน browser)
  const isTikTok = /\.?tiktok\.com$/i.test(dest.hostname) || dest.hostname.endsWith(".tiktok.com");
  const isCoupon =
    /voucher/i.test(dest.pathname) ||
    /linkshare/i.test(dest.pathname);

  if (isTikTok && isCoupon) {
    dest.searchParams.set("use_land_page", "1");
    // เอา flags ที่ชอบซ่อน nav bar ออก เผื่อ in-app ทำงานเพี้ยน
    dest.searchParams.delete("hide_nav_bar");
    dest.searchParams.delete("hide_status_bar");
    dest.searchParams.delete("trans_status_bar");
  }

  // กันของแปลก ๆ
  if (dest.protocol !== "http:" && dest.protocol !== "https:") {
    return NextResponse.redirect(new URL("/", req.url), 302);
  }

  return NextResponse.redirect(dest.toString(), 302);
}
