import { getCollection } from 'astro:content';

// Vydání novinek od nejnovějšího
export async function vydaniNovinek() {
  return (await getCollection('novinky')).sort((a, b) => b.data.datum.valueOf() - a.data.datum.valueOf());
}

// Nejčerstvější položky napříč vydáními: z každého ukazatele jen ta nejnovější, v pořadí, jak je vybral skript.
// Když má poslední vydání míň položek, doplní se z předchozích.
export async function posledniNovinky(kolik = 6) {
  const vydani = await vydaniNovinek();
  const videno = new Set<string>();
  const out = [];
  for (const v of vydani) {
    for (const p of v.data.polozky) {
      if (videno.has(p.id)) continue;
      videno.add(p.id);
      out.push({ ...p, vydani: v.id, datumVydani: v.data.datum });
    }
  }
  return out.slice(0, kolik);
}
