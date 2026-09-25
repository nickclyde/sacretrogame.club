import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The in-memory dev database loads its WebAssembly build from node_modules at runtime.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Box art from Wikipedia.
  images: {
    remotePatterns: [
      new URL("https://upload.wikimedia.org/wikipedia/**"),
      new URL("https://thumb.wikimedia.org/wikipedia/**"),
    ],
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.sacretrogame.club" }],
        destination: "https://sacretrogame.club/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
