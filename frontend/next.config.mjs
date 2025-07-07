/** @type {import('next').NextConfig} */

const backendHost = process.env.BACKEND_HOST || "localhost";

const nextConfig = {
  rewrites: async () => {
    return [
      {
        source: "/api-rewrite/:path*",
        destination: `http://${backendHost}:8008/:path*`,
      },
    ];
  },
};

export default nextConfig;
