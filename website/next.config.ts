import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The canvas fields are all client-rendered; nothing here needs the image
  // optimizer, and keeping it off means the site deploys anywhere unchanged.
  images: { unoptimized: true }
}

export default nextConfig
