import { defineConfig } from 'astro/config';
import client from './src/data/client.json' with { type: 'json' };

export default defineConfig({
  site: client.url,
  output: 'static',
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'auto' },
});
