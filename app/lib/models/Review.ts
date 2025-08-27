// lib/models/Review.ts
import { Schema, models, model } from "mongoose";

const ReviewSchema = new Schema(
  {
    title: { type: String, required: true, index: "text" },
    platform: { type: String, enum: ["tiktok", "youtube", "reels"], required: true },
    productImage: String,
    productGif: String,
    price: String,
    rating: Number,
    tags: { type: [String], default: [] },
    aliases: { type: [String], default: [], index: true },
    publishedAt: { type: Date, required: true },
    reviewUrl: { type: String, required: true },
    affiliateUrl: { type: String, required: true },
    pros: { type: [String], default: [] },
    cons: { type: [String], default: [] },
  },
  { timestamps: true }
);

// useful indexes
ReviewSchema.index({ title: "text", tags: 1, aliases: 1, publishedAt: -1 });

export type ReviewDoc = {
  _id: string;
  title: string;
  platform: "tiktok" | "youtube" | "reels";
  productImage?: string;
  productGif?: string;
  price?: string;
  rating?: number;
  tags: string[];
  aliases: string[];
  publishedAt: string;
  reviewUrl: string;
  affiliateUrl: string;
  pros: string[];
  cons: string[];
};

export default models.Review || model("Review", ReviewSchema);
