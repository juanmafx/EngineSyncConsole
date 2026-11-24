import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "media-src 'self' data: blob:",
  "connect-src 'self'",
  "font-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const contentSecurityPolicyPlugin = () => ({
  name: 'content-security-policy',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
      injectTo: 'head-prepend',
    },
  ],
});

export default defineConfig({
  plugins: [react(), contentSecurityPolicyPlugin()],
  build: { sourcemap: false },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{js,jsx}'],
    restoreMocks: true,
  },
});
