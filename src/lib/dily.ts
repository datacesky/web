// Všechny díly všech sérií v jednom tvaru (stránka Série a upoutávka na úvodní stránce)
import { serie } from '../data/serie';
import { epizody, odkazDilu } from '../data/epizody';

export type Dil = {
  slug: string; serie: string; serieId: string; typ: 'vs' | 'index' | 'sto'; dil?: number; nazev: string; popis: string;
  datum: string; odkaz: string; a3?: string; ikona?: string;
};
export type Rada = { id: string; nazev: string; popis: string; dily: Dil[] };

const CVS = 'Česko vs. svět';
const IG = 'https://www.instagram.com/data.cesky/';

export const rady: Rada[] = [
  {
    id: 'cesko-vs-svet', nazev: CVS, popis: 'Česko vedle jedné země světa: lidé, peníze, příroda a zajímavosti. O dalším díle rozhoduješ ty.',
    dily: epizody.map((e) => ({
      slug: `cesko-vs-svet-${e.dil}`, serie: CVS, serieId: 'cesko-vs-svet', typ: 'vs', dil: e.dil, nazev: e.nazev,
      popis: e.popis, datum: e.datum, odkaz: odkazDilu(e), a3: e.a3,
    })),
  },
  ...serie.map((s) => ({
    id: s.id, nazev: s.nazev, popis: s.popis,
    dily: s.dily.map((d, i): Dil => ({
      slug: `${s.id}-${i + 1}`, serie: s.nazev, serieId: s.id, typ: s.id === 'index-tydne' ? 'index' : 'sto',
      dil: d.cislo, nazev: d.nazev, popis: d.popis, datum: d.datum, odkaz: d.instagram ?? IG, ikona: d.ikona,
    })),
  })),
];

// Od nejnovějšího
export const vsechnyDily = rady.flatMap((r) => r.dily).sort((a, b) => b.datum.localeCompare(a.datum));
