import type { NextConfig } from 'next';
const config: NextConfig = {
  transpilePackages: ['@glitch/shared'],
  allowedDevOrigins: process.env.REPLIT_DEV_DOMAIN ? [process.env.REPLIT_DEV_DOMAIN] : [],
};
export default config;
