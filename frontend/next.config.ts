import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only use standalone output for Docker builds (Vercel requires default output)
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
};

export default nextConfig;
