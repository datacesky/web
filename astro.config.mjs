import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://datacesky.cz',
  // /grafy/ jen přesměrovává na Žebříčky, do mapy webu nepatří
  integrations: [sitemap({ filter: (stranka) => !stranka.endsWith('/grafy/') })],
  // 3D model (three.js) se načítá zvlášť a jen na Mapě Česka, velikost je v pořádku
  vite: { build: { chunkSizeWarningLimit: 800 } },
});
