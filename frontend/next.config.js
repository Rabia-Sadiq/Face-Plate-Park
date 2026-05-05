/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Docker multi-stage build
  output: "standalone",

  images: {
    remotePatterns: [
      { protocol: "http",  hostname: "localhost", port: "8000" },
      { protocol: "https", hostname: "*" },   // for production
    ],
  },
}

module.exports = nextConfig