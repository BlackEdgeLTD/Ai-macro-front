import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@azure/identity", "@azure/storage-blob", "mssql"],
};

export default nextConfig;
