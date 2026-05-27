import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@azure/identity", "mssql"],
  turbopack: {
    resolveAlias: {
      "tw-animate-css": "./node_modules/tw-animate-css/dist/tw-animate.css",
    },
  },
  async rewrites() {
    return [
      { source: "/nadlan", destination: "/nadlan/index.html" },
      { source: "/nadlan/macro", destination: "/nadlan/macro.html" },
      { source: "/nadlan/rent", destination: "/nadlan/rent.html" },
    ];
  },
};

export default nextConfig;
