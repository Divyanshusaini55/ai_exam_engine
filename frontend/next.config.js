/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['katex'],
  experimental: {
    optimizePackageImports: [
      'lucide-react', 
      '@radix-ui/react-dialog', 
      '@radix-ui/react-popover', 
      '@radix-ui/react-progress', 
      '@radix-ui/react-slot',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-label',
      '@radix-ui/react-radio-group',
      'recharts',
      'lucide-react'
    ],
  },
}

module.exports = nextConfig
