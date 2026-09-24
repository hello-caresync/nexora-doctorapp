/** @type {import('next').NextConfig} */
const nextConfig = {
    // Enforces trailing slashes so Cloudflare Pages generates static folder directories (e.g. /superadmin/login/index.html)
    trailingSlash: true,
  
    // Disables strict lint/type-check failures from halting Cloudflare production deployments
    eslint: {
      ignoreDuringBuilds: true,
    },
    typescript: {
      ignoreBuildErrors: true,
    },
  
    // Image optimization setup for static hosting environments
    images: {
      unoptimized: true,
      remotePatterns: [
        {
          protocol: 'https',
          hostname: '**',
        },
      ],
    },
  
    // React strict mode
    reactStrictMode: false,
  };
  
  export default nextConfig;