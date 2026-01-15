import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static export for Tauri packaging
  output: 'export',
  // Disable image optimization server for static export
  images: { unoptimized: true },
  // Transpile monorepo packages
  transpilePackages: ['@repo/ui', '@repo/theme'],
  devIndicators: {
    position: 'top-left',
  },
};

export default nextConfig;
