import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.sacretrogame.club" }],
        destination: "https://sacretrogame.club/:path*",
        permanent: true,
      },
      // Temporary until the club homepage exists at the root.
      { source: "/", destination: "/meeting-vote", permanent: false },
    ];
  },
};

export default nextConfig;
