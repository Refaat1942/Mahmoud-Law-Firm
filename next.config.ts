import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@node-rs/argon2", "@react-pdf/renderer", "exceljs", "bullmq", "ioredis", "docx"],
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default withNextIntl(nextConfig);
