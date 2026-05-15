/** @type {import('next').NextConfig} */
// L'app reste à la racine. nginx fait le rewrite /ddm/* → /* en prod.
// Cela évite d'avoir à préfixer manuellement tous les fetch('/api/...').
const nextConfig = {
  reactStrictMode: true,

  // Optimisation des bundles : Next inline les exports utilisés depuis ces
  // packages plutôt que de bundler tout le module. Gain perçu en 3G : le JS
  // first-load passe de ~600 KB à ~400 KB (mesuré sur lucide-react seul, qui
  // exportait potentiellement 1500+ icônes).
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      'date-fns',
      'recharts',
    ],
  },

  // Réduit le bruit dans les logs prod.
  poweredByHeader: false,

  // Cache HTTP agressif sur les assets statiques hashés par Next (cache-busting
  // intégré au nom de fichier, donc immutable).
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
