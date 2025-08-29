import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import Review from '@/app/lib/models/Review';
import { dbConnect } from '@/app/lib/db';
import { z } from 'zod';

// ---- schema อนุญาต url หรือ '' และแปลง rating/string → number
const dateLike = z.preprocess((v) => {
  if (v instanceof Date) return v;
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
  }
  return v;
}, z.date());

const ReviewUpdate = z.object({
  title: z.string().min(1).optional(),
  platform: z.enum(['tiktok','youtube','reels']).optional(),
  productImage: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  productGif:   z.string().url().optional().or(z.literal('').transform(() => undefined)),
  price: z.string().optional(),
  rating: z.union([z.number(), z.string()]).optional()
    .transform(v => (v === undefined || v === '' ? undefined : Number(v)))
    .refine(v => v === undefined || (!isNaN(v) && v >= 0 && v <= 5), 'rating must be 0..5'),
  tags: z.array(z.string()).optional(),
  aliases: z.array(z.string()).optional(),
  publishedAt: dateLike.optional(),
  reviewUrl: z.string().url().optional(),
  affiliateUrl: z.string().optional(),
  pros: z.array(z.string()).optional(),
  cons: z.array(z.string()).optional(),
});

export const runtime = 'nodejs';

// ---- helper เหมือนฝั่ง POST: รองรับ path → URL เต็ม และเติม https:// ถ้าลืม
function absolutizeHttp(v?: string) {
  if (!v) return v;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v.replace(/^\/+/, '')}`;
}
function absolutizeMedia(v?: string) {
  if (!v) return v;
  if (/^https?:\/\//i.test(v)) return v;
  const MEDIA = (process.env.MEDIA_BASE_URL || 'https://media.ikk.ist').replace(/\/+$/,'');
  return v.startsWith('/') ? `${MEDIA}${v}` : v;
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return new NextResponse('Invalid id', { status: 400 });

  let raw: any = {};
  try { raw = await req.json(); }
  catch { return new NextResponse('Invalid JSON body', { status: 400 }); }

  const MEDIA = (process.env.MEDIA_BASE_URL || 'https://media.ikk.ist').replace(/\/+$/, '');
  const absolutizeMedia = (v?: string) => !v ? v :
    (/^https?:\/\//i.test(v) ? v : v.startsWith('/') ? `${MEDIA}${v}` : v);
  const absolutizeHttp = (v?: string) => !v ? v :
    (/^https?:\/\//i.test(v) ? v : `https://${v.replace(/^\/+/, '')}`);

  if ('productImage' in raw) raw.productImage = absolutizeMedia(raw.productImage);
  if ('productGif'   in raw) raw.productGif   = absolutizeMedia(raw.productGif);
  if ('reviewUrl'    in raw) raw.reviewUrl    = absolutizeHttp(raw.reviewUrl);
  if (raw.rating === '') raw.rating = undefined;

  const parsed = ReviewUpdate.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'ValidationError', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    await Review.updateOne({ _id: id }, { $set: parsed.data });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'DBError', message: e?.message || 'DB error' }, { status: 500 });
  }
}


export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return new NextResponse('Invalid id', { status: 400 });
  try {
    await Review.deleteOne({ _id: id });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'DBError', message: e?.message || 'DB error' }, { status: 500 });
  }
}
