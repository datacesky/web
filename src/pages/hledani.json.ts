// Rejstřík pro hledání napříč webem (okno „Hledat“ v hlavičce, zkratka ⌘K / Ctrl+K).
// Stáhne se až ve chvíli, kdy někdo hledání otevře, takže stránky nijak nezatěžuje.
// Řádek: [druh, název, popisek, odkaz, vlajka nebo ikona, další slova pro hledání]
import { getCollection } from 'astro:content';
import { ZEME, SVET_VRSTVY } from '../lib/svet';
import { vrstvy } from '../data/vrstvy';
import { vsechnyDily } from '../lib/dily';
import { posledniNovinky } from '../lib/novinky';
import { hlasovaniZapnute } from '../data/hlasovani';
import krajeData from '../data/kraje.json';
import mestaData from '../data/mesta.json';

type Radek = [string, string, string, string, string?, string?];

// Jiná jména, pod kterými lidé země hledají
const PREZDIVKY: Record<string, string> = {
  USA: 'Spojené státy Amerika americké US',
  GBR: 'Anglie Británie UK Spojené království Skotsko',
  ARE: 'Emiráty SAE Dubaj',
  NLD: 'Holandsko',
  KOR: 'Korea',
  DEU: 'Německo Deutschland',
  CHE: 'Švýcarsko',
  COD: 'Kongo Kinshasa',
  CIV: 'Côte d’Ivoire',
  MMR: 'Barma',
  SWZ: 'Svazijsko',
  TUR: 'Turecko Türkiye',
};

// Žebříčky, které mají detail na stránce Žebříčky (ostatní ukáže glóbus)
const NA_ZEBRICKACH = new Set(['stesti', 'hdp', 'doziti', 'bm', 'korupce', 'tisk', 'akad', 'gini', 'pop', 'area']);

export async function GET() {
  const radky: Radek[] = [];

  // Stránky a nejdůležitější místa webu
  radky.push(
    ['stranka', 'Novinky z dat', 'Nová čísla od ČSÚ a Eurostatu', '/novinky/', 'blesk'],
    ['stranka', 'Žebříčky', 'Kde je Česko ve světě a žebříčky z Česka', '/zebricky/', 'graf'],
    ['stranka', 'Mapa Česka', 'Kraje, města, vývoj v čase', '/mapa/', 'mapa'],
    ['stranka', 'Svět', 'Glóbus a srovnání s Českem', '/svet/', 'svet'],
    ['stranka', 'Série', 'Všechny díly všech sérií', '/serie/', 'serie'],
    ['stranka', 'Metodika a zdroje', 'Odkud jsou data a jak s nimi pracujeme', '/metodika/', 'kniha', 'opravy chyby licence cc by'],
    ['stranka', 'Soukromí a cookies', 'Co web ukládá', '/metodika/#soukromi', 'stit', 'gdpr'],
    ['mapa', 'Vlaky za 24 hodin', 'Mapa Česka · všech 9 143 vlaků jednoho dne', '/mapa/#v=vlaky', 'vlak', 'železnice jízdní řád doprava'],
    ['mapa', 'Česko ve 3D', 'Mapa Česka · 6 254 obcí jako sloupce', '/mapa/#cesko-3d', 'kostka', 'obce 3d model'],
    ['mapa', 'Kam letí čeští čápi', 'Svět · cesta devíti čápů na zimu', '/svet/#capi', 'ptak', 'čáp čápi migrace ptáci'],
  );
  if (hlasovaniZapnute) radky.push(['stranka', 'Hlasuj o dalším dílu', 'Vyber zemi pro Česko vs. svět', '/hlasovani/', 'hlas', 'hlasování anketa']);

  // Vrstvy mapy Česka
  for (const v of vrstvy) radky.push(['mapa', v.nazev, `Mapa Česka · ${v.popis}`, `/mapa/#v=${v.id}`, 'mapa']);

  // Kraje a města
  for (const k of (krajeData as { kraje: { id: string; nazev: string }[] }).kraje) {
    radky.push(['kraj', k.nazev, 'Kraj · na Mapě Česka', `/mapa/#v=obyvatele&k=${k.id}`, 'spendlik']);
  }
  (mestaData as { mesta: { n: string }[] }).mesta.forEach((m, i) => {
    radky.push(['mesto', m.n, 'Město · vývoj počtu obyvatel', `/mapa/#v=mesta&c=${i}`, 'mesto']);
  });

  // Světové žebříčky
  for (const v of SVET_VRSTVY) {
    if (v.id === 'epizody') continue;
    const url = NA_ZEBRICKACH.has(v.id) ? `/zebricky/#z=${v.id}` : `/svet/#v=${v.id}`;
    radky.push(['zebricek', v.nazev, `Žebříček zemí · ${v.zdroj.split(',')[0].split('(')[0].trim()}`, url, 'graf']);
  }

  // Grafy z Česka
  const grafy = (await getCollection('grafy')).sort((a, b) => b.data.datum.valueOf() - a.data.datum.valueOf());
  for (const g of grafy) radky.push(['graf', g.data.titul, `Graf · ${g.data.tema}`, `/grafy/${g.id}/`, 'graf', g.data.polozky.map((p) => p.nazev).join(' ')]);

  // Novinky z dat
  for (const n of await posledniNovinky(12)) radky.push(['novinka', n.nadpis, `Novinky · ${n.cislo}${n.popisCisla ? ' ' + n.popisCisla : ''}`, `/novinky/#n-${n.id}`, n.ikona ?? 'blesk', n.stitek]);

  // Díly sérií (vedou na video)
  for (const d of vsechnyDily) {
    const nazev = d.typ === 'vs' ? `Česko vs. ${d.nazev}` : d.nazev;
    radky.push(['dil', nazev, `${d.serie}${d.dil ? ` · díl ${d.dil}` : ''}`, d.odkaz, d.a3 ? (ZEME[d.a3]?.[1] ?? 'video') : 'video', d.popis]);
  }

  // Země: srovnání s Českem na glóbusu
  for (const [a3, [nazev, a2]] of Object.entries(ZEME)) {
    if (a3 === 'CZE' || a3 === 'EUZ') continue;
    radky.push(['zeme', nazev, 'Země · porovnej s Českem', `/svet/#z=${a3}`, a2, PREZDIVKY[a3]]);
  }

  return new Response(JSON.stringify(radky.map((r) => (r[5] ? r : r[4] ? r.slice(0, 5) : r.slice(0, 4)))), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
