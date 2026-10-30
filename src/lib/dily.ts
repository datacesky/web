// Všechna videa (díly sérií i samostatná videa) v jednom tvaru: stránka Videa, úvodní stránka a hledání.
// Samostatná videa jsou ze src/data/serie.ts a navíc všechny grafy (src/content/grafy), které mají odkaz na reel.
import { getCollection } from 'astro:content';
import { serie, samostatna, TEMATA, type Tema, type Video } from '../data/serie';
import { IKONA_TEMATU } from './ikony';
import { epizody, odkazDilu, IG_PROFIL } from '../data/epizody';
import { ZEME } from './svet';
import { bezDiakritiky } from './naseptavac';

export type Dil = {
  slug: string; // id videa, podle něj se hledá náhledovka v public/videa/
  serie: string; serieId: string; // u samostatných videí prázdné
  typ: 'vs' | 'index' | 'sto';
  dil?: number;
  nazev: string; // krátký název (v řadě série)
  titul: string; // celý název (všude jinde)
  stitek: string; // nápis nahoře na vygenerované obálce
  popis: string; datum: string; odkaz: string; vyslo: boolean;
  brzy: boolean; // hotové, ale ještě nevyšlo (štítek „Brzy“, bez odkazu)
  a3?: string; ikona?: string; web?: string;
  tema: Tema[];
  hledat: string; // vše, podle čeho jde video najít, bez diakritiky
};
export type Rada = { id: string; nazev: string; popis: string; ikona: string; dily: Dil[] };

const CVS = 'Česko vs. svět';

const hledani = (...casti: (string | undefined)[]) => bezDiakritiky(casti.filter(Boolean).join(' '));

const zVidea = (v: Video, s?: { id: string; nazev: string; predpona?: string }): Dil => {
  const titul = `${s?.predpona ?? ''}${v.nazev}`;
  const temata = v.tema.map((t) => TEMATA[t].nazev);
  return {
    slug: v.id, serie: s?.nazev ?? '', serieId: s?.id ?? '',
    typ: s?.id === 'kdyby-cesko-bylo-100-lidi' ? 'sto' : 'index',
    dil: v.cislo, nazev: v.nazev, titul, stitek: s?.nazev ?? temata[0],
    popis: v.popis, datum: v.datum, odkaz: v.instagram || IG_PROFIL, vyslo: Boolean(v.instagram), brzy: Boolean(v.brzy),
    ikona: v.ikona, web: v.web, tema: v.tema,
    hledat: hledani(titul, v.popis, s?.nazev, temata.join(' '), v.hledat),
  };
};

export const rady: Rada[] = [
  {
    id: 'cesko-vs-svet', nazev: CVS, ikona: 'svet',
    popis: 'Česko vedle jedné země světa: lidé, peníze, příroda a zajímavosti. O dalším díle rozhoduješ ty.',
    dily: epizody.map((e): Dil => ({
      slug: `cesko-vs-svet-${e.dil}`, serie: CVS, serieId: 'cesko-vs-svet', typ: 'vs', dil: e.dil,
      nazev: e.nazev, titul: `Česko vs. ${e.nazev}`, stitek: CVS, popis: e.popis, datum: e.datum,
      odkaz: odkazDilu(e), vyslo: Boolean(e.instagram), brzy: false, a3: e.a3, tema: ['svet'],
      hledat: hledani(`Česko vs. svět ${e.nazev}`, e.popis, ZEME[e.a3]?.[0], 'svet srovnani zeme'),
    })),
  },
  ...serie.map((s) => ({ id: s.id, nazev: s.nazev, popis: s.popis, ikona: s.ikona, dily: s.dily.map((v) => zVidea(v, s)) })),
];

const odNejnovejsiho = (a: Dil, b: Dil) => b.datum.localeCompare(a.datum);

// Témata a ikony grafů (grafy mají vlastní seznam témat)
const TEMA_GRAFU: Record<string, Tema[]> = {
  'Peníze': ['penize', 'cesko'], 'Obyvatelstvo': ['lide', 'cesko'], 'Česko vs. svět': ['svet'], 'Historie': ['historie'],
  'Kultura': ['kultura'], 'Sport': ['kultura'], 'Mapy': ['cesko'], 'Cestování': ['svet', 'cesko'],
};
const IKONA_GRAFU: Record<string, string> = {
  'supermarkety-v-cesku': 'kosik', 'nejvetsi-ceske-firmy': 'tovarna', 'nejbohatsi-cesi': 'penezenka', 'vysokoskolaci-v-evrope': 'lide', 'zahranicni-turiste-2025': 'kufr',
};

// Grafy, ke kterým vyšel reel. Karta vede na reel, pod ní je odkaz na interaktivní graf.
async function videaZGrafu(): Promise<Dil[]> {
  const grafy = (await getCollection('grafy')).filter((g) => g.data.instagram);
  return grafy.map((g) => {
    const tema = TEMA_GRAFU[g.data.tema] ?? ['cesko'];
    return zVidea({
      id: g.id, nazev: g.data.titul, popis: g.data.perex, datum: g.data.datum.toISOString().slice(0, 10), tema,
      instagram: g.data.instagram, ikona: IKONA_GRAFU[g.id] ?? IKONA_TEMATU[g.data.tema], web: `/grafy/${g.id}/`,
      hledat: `${g.data.tema} graf ${g.data.polozky.map((x) => x.nazev).join(' ')}`,
    });
  });
}

export type Videa = { vse: Dil[]; ostatni: Dil[]; rady: Rada[] };

// Všechna videa: vse = od nejnovějšího, ostatni = videa mimo série, rady = série podle nejnovějšího dílu
export async function nactiVidea(): Promise<Videa> {
  const ostatni = [...samostatna.map((v) => zVidea(v)), ...(await videaZGrafu())].sort(odNejnovejsiho);
  const vse = [...rady.flatMap((r) => r.dily), ...ostatni].sort(odNejnovejsiho);
  return { vse, ostatni, rady: radyPodleNovosti };
}

// Série seřazené podle nejnovějšího dílu
export const radyPodleNovosti: Rada[] = [...rady].sort((a, b) => {
  const posl = (r: Rada) => r.dily.reduce((m, d) => (d.datum > m ? d.datum : m), '');
  return posl(b).localeCompare(posl(a));
});
