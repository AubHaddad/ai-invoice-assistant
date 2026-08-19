import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@google-cloud/storage", "pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
