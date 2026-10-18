import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages serves the site from /bitfield/; the workflow sets
  // PAGES_BASE when building there. Local dev and preview stay at /.
  base: process.env.PAGES_BASE ?? '/',
  plugins: [react()],
  // The Verilog sources live in the repo-root src/ folder (the same files
  // the Tiny Tapeout flow hardens), so the dev server must serve one
  // level above the website root.
  server: {
    fs: {
      allow: ['..'],
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
