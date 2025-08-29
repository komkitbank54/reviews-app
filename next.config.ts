import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'media.ikk.ist' }],
  },
};

export default nextConfig;
