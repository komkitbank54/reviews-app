import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import Review from '@/app/lib/models/Review';
import { dbConnect } from '@/app/lib/db';
import { z } from 'zod';

// Define the ReviewUpdate schema for validation
const ReviewUpdate = z.object({
  // Example fields, adjust according to your Review model
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  rating: z.number().min(1).max(5).optional(),
});

export const runtime = 'nodejs';

// ⬇️ เปลี่ยน signature: params เป็น Promise แล้ว await ก่อนใช้
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;            // ✅ await
  if (!Types.ObjectId.isValid(id)) {
    return new NextResponse('Invalid id', { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = ReviewUpdate.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'ValidationError', issues: parsed.error.flatten() }, { status: 400 });
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
  const { id } = await params;            // ✅ await
  if (!Types.ObjectId.isValid(id)) {
    return new NextResponse('Invalid id', { status: 400 });
  }

  try {
    await Review.deleteOne({ _id: id });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'DBError', message: e?.message || 'DB error' }, { status: 500 });
  }
}
