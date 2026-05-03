/** @type {import('next').NextConfig} */
// L'app reste à la racine. nginx fait le rewrite /ddm/* → /* en prod.
// Cela évite d'avoir à préfixer manuellement tous les fetch('/api/...').
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

module.exports = nextConfig;
