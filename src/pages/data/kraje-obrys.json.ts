// Obrys krajů v zeměpisných souřadnicích pro mapu supermarketů: ukáže se, jen když se nenačte podklad mapy.
// Vzniká z SVG mapy Česka (src/data/kraje.json) zpětným přepočtem projekce.
import geo from '../../data/kraje.json';
import podklad from '../../data/cesko-mapa.json';

export function GET() {
  const P = podklad.projekce;
  const naStupne = (x: number, y: number) => [
    Math.round(((x - P.tx) / P.k) * (180 / Math.PI) * 1e3) / 1e3,
    Math.round((2 * Math.atan(Math.exp((P.ty - y) / P.k)) - Math.PI / 2) * (180 / Math.PI) * 1e3) / 1e3,
  ];
  const obrys = {
    type: 'FeatureCollection',
    features: geo.kraje.map((k) => ({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'MultiLineString',
        coordinates: (k.d.match(/M[^M]+/g) ?? []).map((kus) =>
          (kus.match(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/g) ?? []).map((b) => naStupne(...(b.split(',').map(Number) as [number, number]))),
        ),
      },
    })),
  };
  return new Response(JSON.stringify(obrys), { headers: { 'Content-Type': 'application/json' } });
}
