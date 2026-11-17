import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://datacesky.cz',
  // /grafy/ a /hra/ jen přesměrovávají (na Žebříčky a na Hry), do mapy webu nepatří
  integrations: [sitemap({ filter: (stranka) => !stranka.endsWith('/grafy/') && !stranka.endsWith('/hra/') })],
  // 3D model (three.js) se načítá zvlášť a jen na Mapě Česka, velikost je v pořádku
  vite: { build: { chunkSizeWarningLimit: 800 } },
});
