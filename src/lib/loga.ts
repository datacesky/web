// Loga firem a obchodů: soubor public/loga/{název bez diakritiky}.png (nebo .svg, .webp), třeba penny.png,
// skoda-auto.png. Když logo chybí, web ukáže jen název. Loga dodává Adam (oficiální loga značek), nekreslíme je.
import fs from 'node:fs';
import path from 'node:path';

export const slugLoga = (nazev: string) =>
  nazev.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, 'a').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Světlé logo (žlutý nápis), potřebuje tmavý podklad
const TMAVY_PODKLAD = new Set(['billa']);

export function logo(nazev: string): { src: string; tmave: boolean } | null {
  const slug = slugLoga(nazev);
  for (const p of ['svg', 'png', 'webp']) {
    if (fs.existsSync(path.join(process.cwd(), 'public', 'loga', `${slug}.${p}`))) return { src: `/loga/${slug}.${p}`, tmave: TMAVY_PODKLAD.has(slug) };
  }
  return null;
}
