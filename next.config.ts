import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /*
     * Event covers live in Firebase Storage. Narrowed to that one host on
     * purpose — a wildcard here would turn the image optimiser into an open
     * proxy that anyone could point at any URL on the internet.
     */
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/v0/b/**",
      },
    ],
  },
};

export default nextConfig;
