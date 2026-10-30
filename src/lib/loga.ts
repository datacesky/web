// Loga firem a obchodů: soubor public/loga/{název bez diakritiky}.png (nebo .svg, .webp), třeba penny.png,
// skoda-auto.png. Když logo chybí, web ukáže jen název. Loga dodává Adam (oficiální loga značek), nekreslíme je.
import fs from 'node:fs';
import path from 'node:path';

export const slugLoga = (nazev: string) =>
  nazev.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, 'a').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Světlé logo (žlutý nápis), potřebuje tmavý podklad
const TMAVY_PODKLAD = new Set(['billa']);

// Poměr stran loga (šířka / výška) z hlavičky PNG; u ostatních formátů 2 : 1
function pomer(soubor: string): number {
  try {
    const b = fs.readFileSync(soubor);
    if (b.toString('ascii', 1, 4) === 'PNG') return b.readUInt32BE(16) / b.readUInt32BE(20);
  } catch {}
  return 2;
}

export function logo(nazev: string): { src: string; tmave: boolean; pomer: number } | null {
  const slug = slugLoga(nazev);
  for (const p of ['svg', 'png', 'webp']) {
    const soubor = path.join(process.cwd(), 'public', 'loga', `${slug}.${p}`);
    if (fs.existsSync(soubor)) return { src: `/loga/${slug}.${p}`, tmave: TMAVY_PODKLAD.has(slug), pomer: pomer(soubor) };
  }
  return null;
}
