// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://recompsoftware.com',
  trailingSlash: 'always',
  vite: { build: { target: 'es2022' } },
});
