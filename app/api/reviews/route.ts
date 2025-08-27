// app/api/reviews/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import Review from "../../lib/models/Review";
import { dbConnect } from "../../lib/db";

// ... ReviewInput เดิมคงไว้

// ...imports และของเดิมคงไว้

function isTikTokHost(u: URL) {
  const h = u.hostname.toLowerCase();
  return h === "tiktok.com" || h.endsWith(".tiktok.com");
}
function normalizeTikTokUrl(raw: string) {
  const u = new URL(raw);
  ["is_from_webapp","sender_device","sender_web_id","utm_source","utm_medium","utm_campaign"]
    .forEach((k) => u.searchParams.delete(k));
  return u.toString();
}

export async function GET(req: Request) {
  await dbConnect();
  const { searchParams } = new URL(req.url);

  const q = (searchParams.get("q") || "").trim();
  const tags = (searchParams.get("tags") || "").split(",").filter(Boolean);
  const limit = Math.min(parseInt(searchParams.get("limit") || "36", 10), 100);

  const rawTikTokUrl = (searchParams.get("tiktokUrl") || "").trim().replace(/^["']|["']$/g, "");
  if (rawTikTokUrl) {
    try {
      const u = new URL(rawTikTokUrl);
      if (!isTikTokHost(u)) {
        // ไม่ใช่โดเมน tiktok → ปล่อยไปค้นแบบปกติด้านล่าง
        // (อย่าตัด return ที่นี่)
      } else {
        const tiktokUrl = normalizeTikTokUrl(u.toString());

        // -------- ค้น DB แบบ AND เงื่อนไข --------
        const where: any = { reviewUrl: tiktokUrl };
        if (q) {
          where.$or = [
            { title:   { $regex: q, $options: "i" } },
            { aliases: { $regex: q, $options: "i" } },
            { tags:    { $elemMatch: { $regex: q, $options: "i" } } },
          ];
        }
        if (tags.length) where.tags = { $all: tags };

        const projection = {
          title: 1, platform: 1, productImage: 1, productGif: 1, price: 1,
          rating: 1, tags: 1, aliases: 1, publishedAt: 1, reviewUrl: 1,
          affiliateUrl: 1, pros: 1, cons: 1,
        };

        const docs = await Review.find(where)
          .sort({ publishedAt: -1 })
          .limit(limit)
          .lean()
          .select(projection);

        if (docs.length > 0) {
          return NextResponse.json({ data: docs }, {
            headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" },
          });
        }

        // ถ้าไม่มีผลใน DB:
        // - กรณี q มีค่า → แปลว่าไม่มีอะไร match เงื่อนไขทั้งสอง → คืน [] (อย่าฉีด oEmbed)
        if (q || tags.length) {
          return NextResponse.json({ data: [] }, {
            headers: { "Cache-Control": "public, max-age=15" },
          });
        }

        // - กรณี q ว่าง → ค่อย fallback เป็น oEmbed ให้ดูตัวชั่วคราว
        const oembedRes = await fetch(
          "https://www.tiktok.com/oembed?url=" + encodeURIComponent(tiktokUrl),
          { headers: { "User-Agent": "Mozilla/5.0" } }
        );
        if (oembedRes.ok) {
          const meta = await oembedRes.json();
          const temp = {
            _id: "tiktok:" + Buffer.from(tiktokUrl).toString("base64url").slice(0, 24),
            title: meta?.title || "TikTok Video",
            platform: "tiktok" as const,
            productImage: meta?.thumbnail_url || undefined,
            productGif: undefined,
            price: undefined,
            rating: undefined,
            tags: [] as string[],
            aliases: [] as string[],
            publishedAt: new Date(),
            reviewUrl: tiktokUrl,
            affiliateUrl: "",
            pros: [] as string[],
            cons: [] as string[],
          };
          return NextResponse.json({ data: [temp] }, {
            headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" },
          });
        }

        return NextResponse.json({ data: [] }, {
          headers: { "Cache-Control": "public, max-age=15" },
        });
      }
    } catch {
      // ถ้า URL พัง ให้ปล่อยไหลไปค้นแบบปกติด้านล่าง
    }
  }

  // ---------- ค้นหาแบบปกติ (ไม่มี tiktokUrl) ----------
  const where: any = {};
  if (q) {
    where.$or = [
      { title:   { $regex: q, $options: "i" } },
      { aliases: { $regex: q, $options: "i" } },
      { tags:    { $elemMatch: { $regex: q, $options: "i" } } },
    ];
  }
  if (tags.length) where.tags = { $all: tags };

  const docs = await Review.find(where)
    .sort({ publishedAt: -1 })
    .limit(limit)
    .lean()
    .select({
      title: 1, platform: 1, productImage: 1, productGif: 1, price: 1,
      rating: 1, tags: 1, aliases: 1, publishedAt: 1, reviewUrl: 1,
      affiliateUrl: 1, pros: 1, cons: 1,
    });

  return NextResponse.json({ data: docs }, {
    headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" },
  });
}
