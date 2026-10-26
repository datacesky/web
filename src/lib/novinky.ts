import { getCollection, type CollectionEntry } from 'astro:content';

export type Vydani = CollectionEntry<'novinky'>;
export type Novinka = Vydani['data']['polozky'][number];

export const OBLASTI = { cesko: 'Česko', evropa: 'Evropa', svet: 'Svět' } as const;
export type Oblast = keyof typeof OBLASTI;

// Vydání novinek od nejnovějšího
export async function vydaniNovinek() {
  return (await getCollection('novinky')).sort((a, b) => b.data.datum.valueOf() - a.data.datum.valueOf());
}

// Hlavní novinka vydání: podle řádku hlavni:, jinak první položka
export function hlavniNovinka(v: Vydani): Novinka {
  return v.data.polozky.find((p) => p.id === v.data.hlavni) ?? v.data.polozky[0];
}

// Položky vydání s hlavní novinkou na začátku
export function polozkyVydani(v: Vydani): Novinka[] {
  const h = hlavniNovinka(v);
  return [h, ...v.data.polozky.filter((p) => p !== h)];
}

// „Novinky z dat: říjen 2026“ → „Říjen 2026“
export function nazevVydani(v: Vydani): string {
  const t = v.data.titul.replace(/^Novinky z dat:\s*/, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Nejčerstvější položky napříč vydáními: z každého ukazatele jen ta nejnovější, hlavní novinka posledního vydání první.
// Když má poslední vydání míň položek, doplní se z předchozích.
export async function posledniNovinky(kolik = 6) {
  const vydani = await vydaniNovinek();
  const videno = new Set<string>();
  const out = [];
  for (const [i, v] of vydani.entries()) {
    for (const p of polozkyVydani(v)) {
      if (videno.has(p.id)) continue;
      videno.add(p.id);
      out.push({ ...p, vydani: v.id, datumVydani: v.data.datum, hlavni: i === 0 && p === hlavniNovinka(v) });
    }
  }
  return out.slice(0, kolik);
}
