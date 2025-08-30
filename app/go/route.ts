import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isInApp(ua: string) {
  const s = ua.toLowerCase();
  // tiktok/ttwebview + เผื่อกรณีเปิดจากแอพโซเชียลอื่นที่ชอบล็อคใน webview
  return (
    s.includes("tiktok") ||
    s.includes("ttwebview") ||
    s.includes("instagram") ||
    s.includes("fbios") ||
    s.includes("fban") ||
    s.includes("line/") ||
    s.includes("twitter")
  );
}

function isTikTokHost(h: string) {
  const s = h.toLowerCase();
  return s === "tiktok.com" || s.endsWith(".tiktok.com");
}

// ดูว่าเป็นหน้าคูปอง/ลิงก์โปรโมชันของ LinkShare หรือไม่
function isTikTokCouponPath(u: URL) {
  const p = u.pathname.toLowerCase();
  return (
    p.includes("/voucher") ||
    p.includes("/linkshare") ||
    p.endsWith("/voucher.html")
  );
}

// สร้างลิงก์ไปหน้า PDP จาก product_id (ถ้ามี)
function buildTikTokProductUrl(productId: string, chainKey?: string) {
  const url = new URL(`https://www.tiktok.com/view/product/${productId}`);
  url.searchParams.set("scene", "pdp");
  url.searchParams.set("use_land_page", "1"); // ขอเปิดใน browser ปรกติ
  if (chainKey) url.searchParams.set("chain_key", chainKey);
  return url.toString();
}

// เติมตัวช่วยให้เปิดบน browser ปกติ
function preferBrowser(u: URL) {
  u.searchParams.set("use_land_page", "1");
  u.searchParams.delete("hide_nav_bar");
  u.searchParams.delete("hide_status_bar");
  u.searchParams.delete("trans_status_bar");
  return u;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("u");

  if (!raw) {
    return NextResponse.redirect(new URL("/", req.url), 302);
  }

  // decode + ทำให้เป็น absolute
  let decoded = raw;
  try { decoded = decodeURIComponent(raw); } catch {}
  let href = decoded.trim();
  if (!/^https?:\/\//i.test(href)) href = "https://" + href.replace(/^\/+/, "");

  // ตรวจสอบว่าเป็น URL ได้จริง
  let dest: URL;
  try {
    dest = new URL(href);
  } catch {
    return NextResponse.redirect(new URL("/", req.url), 302);
  }

  if (dest.protocol !== "http:" && dest.protocol !== "https:") {
    return NextResponse.redirect(new URL("/", req.url), 302);
  }

  const ua = req.headers.get("user-agent") || "";
  const inApp = isInApp(ua);
  const isTT = isTikTokHost(dest.hostname);

  // เคสทั่วไป: ถ้าไม่ใช่ tiktok → เด้ง 302 ตรง ๆ
  if (!isTT) {
    return NextResponse.redirect(dest.toString(), 302);
  }

  // เคส TikTok: เติมตัวช่วย prefer browser เสมอ
  dest = preferBrowser(dest);

  // ถ้า "ไม่ใช่" coupon → เด้งไปเลย
  if (!isTikTokCouponPath(dest)) {
    return NextResponse.redirect(dest.toString(), 302);
  }

  // ====== เคสคูปอง (เป็นต้นเหตุบั๊ก) ======

  // พยายามหา product_id จากพารามิเตอร์
  const productId =
    dest.searchParams.get("product_id") ||
    dest.searchParams.get("productId") ||
    "";

  const chainKey = dest.searchParams.get("chain_key") || undefined;
  const pdpUrl = productId ? buildTikTokProductUrl(productId, chainKey) : null;

  // ถ้าไม่ใช่ in-app → ให้ลองเด้งไปคูปองโดยตรง (browser ปกติมีโอกาสรอด)
  if (!inApp) {
    return NextResponse.redirect(dest.toString(), 302);
  }

  // ---- In-app: แสดง interstitial เพื่อ "บังคับ" ออกไป browser ปกติ ----
  // เหตุผล: in-app ของ TikTok (voucher.html) crash/blank บ่อย ต้องให้ user กดปุ่มเองถึงจะยอมเด้งออก
  const couponUrl = dest.toString();

  const html = `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>กำลังพาไปหน้าคูปอง…</title>
  <style>
    :root {
      color-scheme: dark;
    }
    body {
      margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji','Segoe UI Emoji';
      background: #0b0b0c; color: #e5e7eb; display: grid; place-items: center; min-height: 100vh;
    }
    .card {
      width: min(560px, 92vw);
      border: 1px solid rgba(255,255,255,0.08);
      background: linear-gradient(180deg, rgba(18,18,20,0.92), rgba(12,12,14,0.9));
      border-radius: 16px; padding: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.35);
      backdrop-filter: blur(8px);
    }
    h1 { font-size: 18px; margin: 0 0 8px; }
    p { font-size: 14px; color: #9ca3af; margin: 0 0 14px; line-height: 1.6; }
    .row { display: grid; gap: 10px; grid-template-columns: 1fr; }
    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      height: 44px; padding: 0 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);
      text-decoration: none; font-weight: 600; letter-spacing: .2px;
    }
    .primary { background: linear-gradient(135deg,#10B981,#059669); color: white; }
    .ghost { background: rgba(255,255,255,0.06); color: #e5e7eb; }
    .hint { font-size: 12px; color: #9ca3af; margin-top: 8px; text-align:center; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace; }
    @media (min-width: 560px) {
      .row { grid-template-columns: 1fr 1fr; }
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>เปิดด้วยเบราว์เซอร์ภายนอก</h1>
    <p>ลิงก์คูปองของ TikTok ชอบมีปัญหาใน in-app browser ของแอพนี้ เราจะแนะนำให้เปิดด้วย Chrome/Safari แทน</p>
    <div class="row">
      <a class="btn primary" id="openBrowser" rel="noopener" href="${couponUrl}" target="_blank">เปิดหน้า “คูปอง” ในเบราว์เซอร์</a>
      ${pdpUrl
        ? `<a class="btn ghost" id="openPdp" rel="noopener" href="${pdpUrl}" target="_blank">ไปหน้า “สินค้า” แทน</a>`
        : `<button class="btn ghost" disabled>ไปหน้า “สินค้า” แทน</button>`
      }
    </div>
    <p class="hint">ถ้าไม่เด้ง ให้แตะเมนู <b>…</b> ด้านขวาบน แล้วเลือก <b>Open in Browser</b><br/>หรือคัดลอกลิงก์ไปวางในเบราว์เซอร์ด้วยตัวเอง</p>
    <p class="hint"><code>${couponUrl.replace(/&/g, "&amp;")}</code></p>
  </div>
  <script>
    // พยายาม auto เปิด tab ใหม่ (บาง in-app อนุญาตตอน onload)
    (function(){
      try {
        const w = window.open("${couponUrl}", "_blank", "noopener");
        if (!w || w.closed) { /* ผู้ใช้ต้องกดเอง */ }
      } catch {}
    })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
