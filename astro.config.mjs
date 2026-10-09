import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://datacesky.cz',
  // /grafy/ jen přesměrovává na Žebříčky, do mapy webu nepatří
  integrations: [sitemap({ filter: (stranka) => !stranka.endsWith('/grafy/') })],
});
