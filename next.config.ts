import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: [
    "@google-cloud/storage",
    "@napi-rs/canvas",
    "pdf-parse",
    "pdf-to-img",
    "pdfjs-dist",
  ],
};

export default nextConfig;
