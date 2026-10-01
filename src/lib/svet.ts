import svet from '../data/svet.json';

// Světová data: názvy zemí, vrstvy a jejich pořadí. Používá je stránka Svět i úvodní stránka.
// Data se generují skriptem (viz metodika) a leží v src/data/svet.json.

export type Zaznam = { a3: string; v: number; r: number };
type Hodnoty = Record<string, number | number[]>;

const V = svet.vrstvy as unknown as Record<string, Hodnoty>;
export const ZEME = svet.zeme as unknown as Record<string, [string, string]>;
export const jmeno = (a3: string) => ZEME[a3]?.[0] ?? a3;
export const vlajka = (a3: string) => (ZEME[a3]?.[1] ? `/vlajky/${ZEME[a3][1]}.svg` : '');

const fmt = (v: number, d = 0) => new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
export const cislo = fmt;
export const lidi = (v: number) =>
  v >= 1e9 ? `${fmt(v / 1e9, 2)} mld.` : v >= 1e6 ? `${fmt(v / 1e6, v >= 1e8 ? 0 : 1)} mil.` : `${fmt(v / 1e3, 0)} tis.`;

export type SvetVrstva = {
  id: string;
  skupina: 'Naše série' | 'Lidé a země' | 'Peníze' | 'Svoboda a společnost';
  nazev: string;
  // Jak se čte pořadí: "11. nejsvobodnější"
  poradiSlovo: string;
  popis: string;
  obdobi: string;
  zdroj: string;
  zdrojUrl: string;
  ikona: string;
  // vzestupne = na 1. místě je nejnižší hodnota (vzdálenost, Gini)
  smer: 'sestupne' | 'vzestupne';
  // Oficiální počet hodnocených zemí, když se liší od počtu v datech
  celkem?: number;
  format: (v: number) => string;
  kratce?: (v: number) => string;
};

// Ikony ve stylu Tabler (obrys, 24×24)
const I = {
  serie: 'M4 6h16v12H4z M10 9.5v5l4.5-2.5z',
  lide: 'M9 7a3 3 0 1 0 0 .01 M3 20v-1a6 6 0 0 1 12 0v1 M16 4.5a3 3 0 0 1 0 5.6 M21 20v-1a6 6 0 0 0-4-5.6',
  rozloha: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
  srdce: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  vzdalenost: 'M6 18a2 2 0 1 0 0 .01 M18 6a2 2 0 1 0 0 .01 M8 18h5a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h5',
  penize: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M14.8 9A2 2 0 0 0 13 8h-2a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4h-2a2 2 0 0 1-1.8-1 M12 6v2 M12 16v2',
  burger: 'M4 15h16a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z M12 4c3.9 0 7 2.2 8 5H4c1-2.8 4.1-5 8-5z M4 12h16',
  vahy: 'M7 20h10 M12 4v16 M5 8l7-2 7 2 M5 8l-2.5 6a3 3 0 0 0 5 0z M19 8l-2.5 6a3 3 0 0 0 5 0z',
  noviny: 'M16 6h3a1 1 0 0 1 1 1v11a2 2 0 0 1-4 0V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v12a3 3 0 0 0 3 3h11 M8 8h4 M8 12h4 M8 16h4',
  cepice: 'M22 9L12 5 2 9l10 4z M6 10.6V16a6 3 0 0 0 12 0v-5.4 M22 9v6',
  stit: 'M12 3a12 12 0 0 0 8.5 3A12 12 0 0 1 12 21 12 12 0 0 1 3.5 6 12 12 0 0 0 12 3 M9 12l2 2 4-4',
  usmev: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M9 10h.01 M15 10h.01 M9.5 15a3.5 3.5 0 0 0 5 0',
};

export const SVET_VRSTVY: SvetVrstva[] = [
  {
    id: 'epizody', skupina: 'Naše série', nazev: 'Česko vs. svět', poradiSlovo: '', ikona: I.serie, smer: 'sestupne',
    popis: 'Země, které jsme v sérii postavili vedle Česka.', obdobi: '', zdroj: 'data.cesky', zdrojUrl: '/serie/',
    format: String,
  },
  {
    id: 'pop', skupina: 'Lidé a země', nazev: 'Počet obyvatel', poradiSlovo: 'nejlidnatější', ikona: I.lide, smer: 'sestupne',
    popis: 'Kolik lidí v zemi žije (odhad k polovině roku).', obdobi: '2025',
    zdroj: 'Světová banka (SP.POP.TOTL)', zdrojUrl: 'https://data.worldbank.org/indicator/SP.POP.TOTL',
    format: lidi,
  },
  {
    id: 'area', skupina: 'Lidé a země', nazev: 'Rozloha', poradiSlovo: 'největší', ikona: I.rozloha, smer: 'sestupne',
    popis: 'Celková rozloha včetně vnitrozemských vod.', obdobi: '2023',
    zdroj: 'Světová banka (AG.SRF.TOTL.K2)', zdrojUrl: 'https://data.worldbank.org/indicator/AG.SRF.TOTL.K2',
    format: (v) => `${fmt(v)} km²`,
    kratce: (v) => (v >= 1e6 ? `${fmt(v / 1e6, 1)} mil. km²` : `${fmt(v / 1e3, 0)} tis. km²`),
  },
  {
    id: 'doziti', skupina: 'Lidé a země', nazev: 'Naděje dožití', poradiSlovo: 'nejvyšší', ikona: I.srdce, smer: 'sestupne',
    popis: 'Kolik let se v průměru dožije člověk narozený v daném roce.', obdobi: '2024',
    zdroj: 'Světová banka (SP.DYN.LE00.IN)', zdrojUrl: 'https://data.worldbank.org/indicator/SP.DYN.LE00.IN',
    format: (v) => `${fmt(v, 1)} let`,
  },
  {
    id: 'km', skupina: 'Lidé a země', nazev: 'Vzdálenost od Prahy', poradiSlovo: 'nejbližší', ikona: I.vzdalenost, smer: 'vzestupne',
    popis: 'Vzdušnou čarou z Prahy do hlavního města.', obdobi: '',
    zdroj: 'Natural Earth, vlastní výpočet', zdrojUrl: 'https://www.naturalearthdata.com/',
    format: (v) => `${fmt(v)} km`,
  },
  {
    id: 'hdp', skupina: 'Peníze', nazev: 'HDP na obyvatele', poradiSlovo: 'nejvyšší', ikona: I.penize, smer: 'sestupne',
    popis: 'V paritě kupní síly, tedy po zohlednění cen v dané zemi. Mezinárodní dolary.', obdobi: '2025, u několika zemí starší',
    zdroj: 'Světová banka (NY.GDP.PCAP.PP.CD)', zdrojUrl: 'https://data.worldbank.org/indicator/NY.GDP.PCAP.PP.CD',
    format: (v) => `${fmt(v)} $`,
    kratce: (v) => `${fmt(v / 1000, 0)} tis. $`,
  },
  {
    id: 'bm', skupina: 'Peníze', nazev: 'Big Mac index', poradiSlovo: 'nejdražší', ikona: I.burger, smer: 'sestupne',
    popis: 'Kolik stojí Big Mac v přepočtu na dolary.', obdobi: 'červenec 2026',
    zdroj: 'The Economist, Big Mac index', zdrojUrl: 'https://github.com/TheEconomist/big-mac-data',
    format: (v) => `${fmt(v, 2)} USD`,
  },
  {
    id: 'gini', skupina: 'Peníze', nazev: 'Rovnost příjmů', poradiSlovo: 'nejrovnější', ikona: I.vahy, smer: 'vzestupne',
    popis: 'Giniho index: 0 = všichni mají stejně, 100 = všechno má jeden. Čím nižší, tím rovnější. Poslední dostupný rok, u části zemí se měří spotřeba místo příjmů.',
    obdobi: 'poslední dostupný rok',
    zdroj: 'Světová banka (SI.POV.GINI)', zdrojUrl: 'https://data.worldbank.org/indicator/SI.POV.GINI',
    format: (v) => fmt(v, 1),
  },
  {
    id: 'tisk', skupina: 'Svoboda a společnost', nazev: 'Svoboda tisku', poradiSlovo: 'nejsvobodnější', ikona: I.noviny, smer: 'sestupne', celkem: 180,
    popis: 'Skóre 0 až 100 podle Reportérů bez hranic. Čím víc, tím svobodnější média.', obdobi: '2026',
    zdroj: 'Reporters Without Borders, World Press Freedom Index 2026', zdrojUrl: 'https://rsf.org/en/index',
    format: (v) => `${fmt(v, 1)} bodu`,
    kratce: (v) => fmt(v, 1),
  },
  {
    id: 'akad', skupina: 'Svoboda a společnost', nazev: 'Akademická svoboda', poradiSlovo: 'nejsvobodnější', ikona: I.cepice, smer: 'sestupne',
    popis: 'Index 0 až 1: jak svobodně můžou vědci a univerzity bádat a učit.', obdobi: '2025',
    zdroj: 'V-Dem, Academic Freedom Index (přes Our World in Data)', zdrojUrl: 'https://ourworldindata.org/grapher/academic-freedom-index',
    format: (v) => fmt(v, 2),
  },
  {
    id: 'korupce', skupina: 'Svoboda a společnost', nazev: 'Vnímání korupce', poradiSlovo: 'nejméně zkorumpovaná', ikona: I.stit, smer: 'sestupne', celkem: 182,
    popis: 'Skóre 0 až 100: 0 = velmi zkorumpované, 100 = velmi čisté.', obdobi: '2025',
    zdroj: 'Transparency International, Corruption Perceptions Index 2025', zdrojUrl: 'https://www.transparency.org/en/cpi/2025',
    format: (v) => `${fmt(v)} bodů`,
    kratce: (v) => fmt(v),
  },
  {
    id: 'stesti', skupina: 'Svoboda a společnost', nazev: 'Štěstí', poradiSlovo: 'nejšťastnější', ikona: I.usmev, smer: 'sestupne',
    popis: 'Jak lidé hodnotí svůj život na škále 0 až 10, průměr let 2023 až 2025.', obdobi: '2023–2025',
    zdroj: 'World Happiness Report 2026 (přes Our World in Data)', zdrojUrl: 'https://ourworldindata.org/grapher/happiness-cantril-ladder',
    format: (v) => fmt(v, 2),
  },
];

export const SKUPINY = ['Naše série', 'Lidé a země', 'Peníze', 'Svoboda a společnost'] as const;
export const vrstvaPodleId = (id: string) => SVET_VRSTVY.find((v) => v.id === id);

export function hodnota(id: string, a3: string): number | undefined {
  const x = V[id]?.[a3];
  if (x === undefined) return undefined;
  return Array.isArray(x) ? x[0] : x;
}
export function rok(id: string, a3: string): number | undefined {
  const x = V[id]?.[a3];
  return Array.isArray(x) && (id === 'pop' || id === 'area' || id === 'hdp' || id === 'doziti' || id === 'gini') ? x[1] : undefined;
}
const oficialni = (id: string, a3: string) => (id === 'tisk' || id === 'korupce' ? (V[id][a3] as number[])[1] : undefined);

const cache = new Map<string, Zaznam[]>();
// Celý žebříček vrstvy. Stejné hodnoty sdílí místo (1, 2, 2, 4).
export function zebricek(id: string): Zaznam[] {
  if (cache.has(id)) return cache.get(id)!;
  const v = vrstvaPodleId(id)!;
  const data = V[id] ?? {};
  const zaznamy = Object.keys(data).map((a3) => ({ a3, v: hodnota(id, a3)! }));
  const k = v.smer === 'sestupne' ? -1 : 1;
  zaznamy.sort((a, b) => k * (a.v - b.v) || jmeno(a.a3).localeCompare(jmeno(b.a3), 'cs'));
  const out: Zaznam[] = [];
  zaznamy.forEach((z, i) => {
    const r = oficialni(id, z.a3) ?? (i > 0 && z.v === zaznamy[i - 1].v ? out[i - 1].r : i + 1);
    out.push({ ...z, r });
  });
  cache.set(id, out);
  return out;
}
export const pocet = (id: string) => vrstvaPodleId(id)?.celkem ?? zebricek(id).length;
export const poradiZeme = (id: string, a3: string) => zebricek(id).find((z) => z.a3 === a3)?.r;

export const META = svet.meta;
