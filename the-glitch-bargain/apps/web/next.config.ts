import type { NextConfig } from 'next';
const config: NextConfig = {
  transpilePackages: ['@glitch/shared', '@glitch/server'],
  serverExternalPackages: ['ioredis', 'ws'],
  allowedDevOrigins: process.env.REPLIT_DEV_DOMAIN ? [process.env.REPLIT_DEV_DOMAIN] : [],
};
export default config;
