// app/api/reviews/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import Review from "../../lib/models/Review";
import { dbConnect } from "../../lib/db";

// บังคับให้รันบน Node.js (ป้องกันปัญหา Buffer/URL บางเคสถ้าไป Edge)
export const runtime = "nodejs";

// ---------- Utils ----------
function isTikTokHost(u: URL) {
  const h = u.hostname.toLowerCase();
  return h === "tiktok.com" || h.endsWith(".tiktok.com");
}
function normalizeTikTokUrl(raw: string) {
  const u = new URL(raw);
  [
    "is_from_webapp",
    "sender_device",
    "sender_web_id",
    "utm_source",
    "utm_medium",
    "utm_campaign",
  ].forEach((k) => u.searchParams.delete(k));
  return u.toString();
}

// ---------- Zod Schema ----------
const dateLike = z.preprocess((v) => {
  // รับทั้ง string/number/Date แล้วพยายามแปลงเป็น Date ที่ valid
  if (v instanceof Date) return v;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
  }
  return v;
}, z.date({ required_error: "publishedAt is required" }));

const ReviewInput = z.object({
  title: z.string().min(1),
  platform: z.enum(["tiktok", "youtube", "reels"]),
  productImage: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  productGif: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  price: z.string().optional(),
  // อนุญาตส่งเป็น string ที่แปลงได้
  rating: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => (v === undefined || v === "" ? undefined : Number(v)))
    .refine((v) => v === undefined || (!isNaN(v) && v >= 0 && v <= 5), "rating must be 0..5"),
  tags: z.array(z.string()).default([]),
  aliases: z.array(z.string()).default([]),
  publishedAt: dateLike, // ใช้ตัวแปลงด้านบน
  reviewUrl: z.string().url(),
  affiliateUrl: z.string().optional().default(""),
  pros: z.array(z.string()).default([]),
  cons: z.array(z.string()).default([]),
});

// ---------- GET ----------
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
      if (isTikTokHost(u)) {
        const tiktokUrl = normalizeTikTokUrl(u.toString());
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
          return NextResponse.json(
            { data: docs },
            { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } }
          );
        }

        if (q || tags.length) {
          return NextResponse.json(
            { data: [] },
            { headers: { "Cache-Control": "public, max-age=15" } }
          );
        }

        // fallback oEmbed (ไม่มีใน DB และไม่มี q/tags เพิ่ม)
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
          return NextResponse.json(
            { data: [temp] },
            { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } }
          );
        }

        return NextResponse.json(
          { data: [] },
          { headers: { "Cache-Control": "public, max-age=15" } }
        );
      }
    } catch {
      // invalid URL → ตกไปค้นปกติด้านล่าง
    }
  }

  // ค้นหาปกติ
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

  return NextResponse.json(
    { data: docs },
    { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } }
  );
}

// ---------- POST (เพิ่มข้อมูล) ----------
export async function POST(req: Request) {
  if (!process.env.ADMIN_TOKEN) {
    return new NextResponse("ADMIN_TOKEN not set", { status: 500 });
  }
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  await dbConnect();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return new NextResponse("Invalid JSON body", { status: 400 });
  }

  // normalize reviewUrl (โดยเฉพาะ TikTok)
  if (typeof raw === "object" && raw && "reviewUrl" in (raw as any)) {
    try {
      const u = new URL((raw as any).reviewUrl);
      if (isTikTokHost(u)) {
        (raw as any).reviewUrl = normalizeTikTokUrl(u.toString());
      }
    } catch {
      // ปล่อยให้ schema ตรวจจับ url พังเอง
    }
  }

  const parsed = ReviewInput.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "ValidationError", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const doc = await Review.create(parsed.data);
    return NextResponse.json({ data: { id: doc._id } }, { status: 201 });
  } catch (e: any) {
    // กัน duplicate key หรือ validation ฝั่ง Mongo
    const msg = e?.message || "DB error";
    return NextResponse.json({ error: "DBError", message: msg }, { status: 500 });
  }
}
