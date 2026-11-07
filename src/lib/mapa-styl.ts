// Podklad mapy supermarketů: vektorové dlaždice OpenFreeMap (data OpenStreetMap, schéma OpenMapTiles),
// přebarvené do barev webu. Bez klíče a limitů, https://openfreemap.org. Světlá a tmavá paleta se přepínají
// přes setPaintProperty, takže vrstvy s prodejnami zůstanou na mapě.
import type { StyleSpecification, LayerSpecification } from 'maplibre-gl';

const BARVY = {
  svetly: {
    pozadi: '#F3EEE4', sidla: '#ECE5D7', prumysl: '#E7E0D2', les: '#E2E5D0', trava: '#E8EAD8', park: '#DDE6CC',
    voda: '#BCD5E8', reka: '#A9CBE3', budova: '#E4DBC9', budovaObrys: '#D6CBB6',
    dalnice: '#F7CB9C', dalniceObrys: '#E0A66B', hlavni: '#FFFFFF', hlavniObrys: '#D8CDB8', mistni: '#FFFFFF', mistniObrys: '#E2D8C6',
    cesta: '#CDBFA6', zeleznice: '#B3A792', hraniceStatu: '#6E7C96', hraniceKraje: '#B9AE9B',
    text: '#1B2A4A', textSlaby: '#56627A', textVoda: '#3F6F9F', halo: 'rgba(243, 238, 228, 0.92)',
  },
  tmavy: {
    pozadi: '#0E1628', sidla: '#141F35', prumysl: '#172238', les: '#122236', trava: '#13213A', park: '#13263A',
    voda: '#1A3356', reka: '#1E3A60', budova: '#1C2843', budovaObrys: '#24324F',
    dalnice: '#6E4A26', dalniceObrys: '#8A5E30', hlavni: '#2C3A58', hlavniObrys: '#1A2540', mistni: '#25314C', mistniObrys: '#1A2440',
    cesta: '#33425F', zeleznice: '#46557A', hraniceStatu: '#8C9AB5', hraniceKraje: '#3E4C6E',
    text: '#ECE5D7', textSlaby: '#B9B3A7', textVoda: '#8DB6D4', halo: 'rgba(14, 22, 40, 0.9)',
  },
};
type Paleta = typeof BARVY.svetly;
type Klic = keyof Paleta;

const NAZEV = ['coalesce', ['get', 'name:cs'], ['get', 'name']] as unknown as string;
const PISMO = ['Noto Sans Regular'], TUCNE = ['Noto Sans Bold'], KURZIVA = ['Noto Sans Italic'];

// Vrstva + které její barvy jsou z palety (vlastnost → klíč palety)
type Def = { vrstva: LayerSpecification; barvy: Record<string, Klic> };
const sirka = (z: [number, number][]) => ['interpolate', ['exponential', 1.5], ['zoom'], ...z.flat()] as unknown as number;

function silnice(id: string, tridy: string[], minzoom: number, w: [number, number][], obrysW: [number, number][], barva: Klic, obrys: Klic): Def[] {
  const filtr = ['all', ['in', ['get', 'class'], ['literal', tridy]], ['!=', ['get', 'brunnel'], 'tunnel']] as any;
  return [
    { vrstva: { id: `${id}-obrys`, type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom, filter: filtr, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-width': sirka(obrysW) } }, barvy: { 'line-color': obrys } },
    { vrstva: { id, type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom, filter: filtr, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-width': sirka(w) } }, barvy: { 'line-color': barva } },
  ];
}

const DEFINICE: Def[] = [
  { vrstva: { id: 'pozadi', type: 'background', paint: {} }, barvy: { 'background-color': 'pozadi' } },
  { vrstva: { id: 'les', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'wood'], paint: { 'fill-opacity': 0.9 } }, barvy: { 'fill-color': 'les' } },
  { vrstva: { id: 'trava', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover', filter: ['in', ['get', 'class'], ['literal', ['grass', 'wetland']]], paint: { 'fill-opacity': 0.7 } }, barvy: { 'fill-color': 'trava' } },
  { vrstva: { id: 'sidla', type: 'fill', source: 'openmaptiles', 'source-layer': 'landuse', filter: ['in', ['get', 'class'], ['literal', ['residential', 'suburb', 'neighbourhood', 'village']]], paint: {} }, barvy: { 'fill-color': 'sidla' } },
  { vrstva: { id: 'prumysl', type: 'fill', source: 'openmaptiles', 'source-layer': 'landuse', minzoom: 10, filter: ['in', ['get', 'class'], ['literal', ['industrial', 'commercial', 'retail', 'railway']]], paint: {} }, barvy: { 'fill-color': 'prumysl' } },
  { vrstva: { id: 'park', type: 'fill', source: 'openmaptiles', 'source-layer': 'park', paint: { 'fill-opacity': 0.8 } }, barvy: { 'fill-color': 'park' } },
  { vrstva: { id: 'voda', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', filter: ['!=', ['get', 'brunnel'], 'tunnel'], paint: {} }, barvy: { 'fill-color': 'voda' } },
  { vrstva: { id: 'reky', type: 'line', source: 'openmaptiles', 'source-layer': 'waterway', filter: ['all', ['!=', ['get', 'brunnel'], 'tunnel'], ['any', ['==', ['get', 'class'], 'river'], ['>=', ['zoom'], 12]]], layout: { 'line-cap': 'round' }, paint: { 'line-width': sirka([[8, 0.8], [12, 1.6], [16, 4]]) } }, barvy: { 'line-color': 'reka' } },
  { vrstva: { id: 'budovy', type: 'fill', source: 'openmaptiles', 'source-layer': 'building', minzoom: 14, paint: { 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, 1] } }, barvy: { 'fill-color': 'budova', 'fill-outline-color': 'budovaObrys' } },
  { vrstva: { id: 'cesty', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom: 14, filter: ['in', ['get', 'class'], ['literal', ['path', 'track']]], paint: { 'line-width': 1, 'line-dasharray': [2, 2] } }, barvy: { 'line-color': 'cesta' } },
  ...silnice('mistni', ['minor', 'service'], 12, [[12, 0.6], [14, 2.5], [17, 10]], [[12, 0.8], [14, 3.5], [17, 12]], 'mistni', 'mistniObrys'),
  ...silnice('vedlejsi', ['secondary', 'tertiary'], 9, [[9, 0.6], [12, 1.8], [14, 4], [17, 14]], [[9, 0.9], [12, 2.6], [14, 5.5], [17, 16]], 'hlavni', 'hlavniObrys'),
  ...silnice('hlavni', ['primary', 'trunk'], 7, [[7, 0.7], [10, 1.8], [14, 5], [17, 16]], [[7, 1], [10, 2.6], [14, 6.5], [17, 18]], 'hlavni', 'hlavniObrys'),
  ...silnice('dalnice', ['motorway'], 5, [[5, 0.8], [10, 2.2], [14, 5.5], [17, 16]], [[5, 1.2], [10, 3.2], [14, 7.5], [17, 19]], 'dalnice', 'dalniceObrys'),
  { vrstva: { id: 'zeleznice', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom: 9, filter: ['all', ['==', ['get', 'class'], 'rail'], ['!=', ['get', 'brunnel'], 'tunnel']], paint: { 'line-width': sirka([[9, 0.6], [14, 1.6]]), 'line-dasharray': [3, 2] } }, barvy: { 'line-color': 'zeleznice' } },
  { vrstva: { id: 'hranice-kraje', type: 'line', source: 'openmaptiles', 'source-layer': 'boundary', minzoom: 6, filter: ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]], paint: { 'line-width': 1, 'line-dasharray': [4, 3] } }, barvy: { 'line-color': 'hraniceKraje' } },
  { vrstva: { id: 'hranice-statu', type: 'line', source: 'openmaptiles', 'source-layer': 'boundary', filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]], paint: { 'line-width': sirka([[5, 1.2], [10, 2]]), 'line-opacity': 0.8 } }, barvy: { 'line-color': 'hraniceStatu' } },
  { vrstva: { id: 'nazvy-ulic', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name', minzoom: 14, layout: { 'symbol-placement': 'line', 'text-field': NAZEV, 'text-font': PISMO, 'text-size': 11, 'text-max-angle': 30 }, paint: { 'text-halo-width': 1.4 } }, barvy: { 'text-color': 'textSlaby', 'text-halo-color': 'halo' } },
  { vrstva: { id: 'nazvy-rek', type: 'symbol', source: 'openmaptiles', 'source-layer': 'waterway', minzoom: 11, filter: ['==', ['get', 'class'], 'river'], layout: { 'symbol-placement': 'line', 'text-field': NAZEV, 'text-font': KURZIVA, 'text-size': 11.5 }, paint: { 'text-halo-width': 1.4 } }, barvy: { 'text-color': 'textVoda', 'text-halo-color': 'halo' } },
  {
    vrstva: {
      id: 'nazvy-obci', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place',
      filter: ['any',
        ['==', ['get', 'class'], 'city'],
        ['all', ['==', ['get', 'class'], 'town'], ['>=', ['zoom'], 8]],
        ['all', ['==', ['get', 'class'], 'village'], ['>=', ['zoom'], 11]],
        ['all', ['in', ['get', 'class'], ['literal', ['suburb', 'quarter']]], ['>=', ['zoom'], 12]]],
      layout: {
        'text-field': NAZEV,
        'text-font': ['match', ['get', 'class'], ['city', 'town'], ['literal', TUCNE], ['literal', PISMO]] as any,
        'text-size': ['interpolate', ['linear'], ['zoom'], 6, ['match', ['get', 'class'], 'city', 13, 'town', 11, 10], 14, ['match', ['get', 'class'], 'city', 20, 'town', 16, 'village', 14, 12.5]] as any,
        'text-max-width': 8, 'symbol-sort-key': ['get', 'rank'] as any,
      },
      paint: { 'text-halo-width': 1.6 },
    },
    barvy: { 'text-color': 'text', 'text-halo-color': 'halo' },
  },
  { vrstva: { id: 'nazvy-statu', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', maxzoom: 9, filter: ['==', ['get', 'class'], 'country'], layout: { 'text-field': NAZEV, 'text-font': TUCNE, 'text-size': 13, 'text-transform': 'uppercase', 'text-letter-spacing': 0.15 }, paint: { 'text-halo-width': 1.6 } }, barvy: { 'text-color': 'textSlaby', 'text-halo-color': 'halo' } },
];

export function stylMapy(tmavy: boolean): StyleSpecification {
  const p = tmavy ? BARVY.tmavy : BARVY.svetly;
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: { openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
    layers: DEFINICE.map(({ vrstva, barvy }) => {
      const paint = { ...((vrstva as any).paint ?? {}) };
      for (const [vlastnost, klic] of Object.entries(barvy)) paint[vlastnost] = p[klic];
      return { ...vrstva, paint } as LayerSpecification;
    }),
  };
}

export function prebarvi(map: { setPaintProperty: (l: string, p: string, v: unknown) => void; getLayer: (id: string) => unknown }, tmavy: boolean) {
  const p = tmavy ? BARVY.tmavy : BARVY.svetly;
  for (const { vrstva, barvy } of DEFINICE) {
    if (!map.getLayer(vrstva.id)) continue;
    for (const [vlastnost, klic] of Object.entries(barvy)) map.setPaintProperty(vrstva.id, vlastnost, p[klic]);
  }
}

export const PODKLAD = (tmavy: boolean) => (tmavy ? BARVY.tmavy : BARVY.svetly);
