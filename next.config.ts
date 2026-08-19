import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@google-cloud/storage",
    "@napi-rs/canvas",
    "pdf-parse",
    "pdf-to-img",
    "pdfjs-dist",
  ],
};

export default nextConfig;
