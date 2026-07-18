/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Upload ficticio da Fase 4 (limite do app: 2 MB por arquivo).
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
