import type { NextConfig } from "next";

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'media.ikk.ist' },
    ],
  },
  env: {
    NEXT_PUBLIC_MEDIA_BASE_URL: process.env.MEDIA_BASE_URL,
  },
};
export default nextConfig;

