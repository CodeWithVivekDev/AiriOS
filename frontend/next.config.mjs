/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow loading VRM models from CDN
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.jsdelivr.net",
      },
    ],
  },
  // Transpile Three.js modules
  transpilePackages: ["three", "@pixiv/three-vrm"],
};

export default nextConfig;
