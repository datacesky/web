// Trasy pro mapu supermarketů na datacesky.cz: Cloudflare Worker, který drží API klíč Mapy.com v tajnosti
// a přeposílá jen dva druhy dotazů. Nasazení a nastavení klíče: navody/trasy/README.md
//
// 1) Vzdálenost a čas k víc prodejnám (Matrix routing, 1 start × nejvýš 25 prodejen):
//    GET /?z=14.4378,50.0755&do=14.44,50.07;14.45,50.08&typ=foot_fast
//    Odpověď: odpověď Mapy.com ({ matrix: [[{ length, duration }, …]] }), délka v metrech, čas v sekundách.
// 2) Trasa k jedné prodejně i s čárou na mapu (Routing):
//    GET /?trasa=1&z=14.4378,50.0755&do=14.44,50.07&typ=foot_fast
//    Odpověď: { m: délka v metrech, s: čas v sekundách, cara: [[lon, lat], …] }

const TYPY = new Set(['car_fast', 'foot_fast']);
const MAX_CILU = 25;
// Česko s rezervou (prodejny u hranic a lidé těsně za ní)
const OBDELNIK = { z: 11.6, j: 48.2, v: 19.3, s: 51.4 };

function souradnice(text) {
  const m = /^(-?\d{1,2}(?:\.\d{1,7})?),(-?\d{1,2}(?:\.\d{1,7})?)$/.exec(text || '');
  if (!m) return null;
  const lon = Number(m[1]), lat = Number(m[2]);
  if (lon < OBDELNIK.z || lon > OBDELNIK.v || lat < OBDELNIK.j || lat > OBDELNIK.s) return null;
  return [lon, lat];
}

export default {
  async fetch(request, env, ctx) {
    const povolene = (env.POVOLENE || 'https://datacesky.cz,https://www.datacesky.cz').split(',').map((s) => s.trim());
    const origin = request.headers.get('Origin') || '';
    const hlavicky = {
      'Access-Control-Allow-Origin': povolene.includes(origin) ? origin : povolene[0],
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Vary': 'Origin',
      'Content-Type': 'application/json; charset=utf-8',
    };
    const odpoved = (telo, status = 200, navic = {}) => new Response(JSON.stringify(telo), { status, headers: { ...hlavicky, ...navic } });

    if (request.method === 'OPTIONS') return new Response(null, { headers: hlavicky });
    if (request.method !== 'GET') return odpoved({ chyba: 'Jen GET' }, 405);
    // Jen z webu datacesky.cz (a z náhledu na localhostu, když ho povolíš v POVOLENE)
    if (!povolene.includes(origin)) return odpoved({ chyba: 'Nepovolený web' }, 403);
    if (!env.MAPY_KLIC) return odpoved({ chyba: 'Chybí klíč Mapy.com (MAPY_KLIC)' }, 500);

    const url = new URL(request.url);
    const start = souradnice(url.searchParams.get('z'));
    const cile = (url.searchParams.get('do') || '').split(';').filter(Boolean).map(souradnice);
    const typ = url.searchParams.get('typ');
    const jednaTrasa = url.searchParams.has('trasa');
    if (!start || !cile.length || cile.length > (jednaTrasa ? 1 : MAX_CILU) || cile.some((c) => !c) || !TYPY.has(typ)) {
      return odpoved({ chyba: 'Špatný dotaz' }, 400);
    }

    // Start se zaokrouhlí na 4 desetinná místa (asi 10 m): méně se toho pošle dál a víc dotazů se trefí do mezipaměti
    const z = `${start[0].toFixed(4)},${start[1].toFixed(4)}`;
    const d = cile.map((c) => `${c[0]},${c[1]}`).join(';');

    if (jednaTrasa) return trasa(z, d, typ, env, ctx, hlavicky, odpoved);
    const klicMezipameti = new Request(`https://trasy.cache/${typ}/${z}/${d}`);
    const mezipamet = caches.default;
    const ulozena = await mezipamet.match(klicMezipameti);
    if (ulozena) return new Response(ulozena.body, { headers: { ...hlavicky, 'X-Mezipamet': 'ano' } });

    const mapy = new URL('https://api.mapy.com/v1/routing/matrix-m');
    mapy.searchParams.set('starts', z);
    mapy.searchParams.set('ends', d);
    mapy.searchParams.set('routeType', typ);
    const r = await fetch(mapy, { headers: { 'X-Mapy-Api-Key': env.MAPY_KLIC, 'Accept': 'application/json' } });
    if (!r.ok) return odpoved({ chyba: `Mapy.com odpověděly ${r.status}` }, 502);
    const telo = await r.text();
    // Uložit na týden: silnice se mění pomalu
    ctx.waitUntil(mezipamet.put(klicMezipameti, new Response(telo, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=604800' } })));
    return new Response(telo, { headers: hlavicky });
  },
};

// Jedna trasa i s geometrií. Čára se zaokrouhlí na 5 desetinných míst (asi 1 m) a vynechají se zbytečné body,
// ať je odpověď malá.
async function trasa(z, d, typ, env, ctx, hlavicky, odpoved) {
  const klic = new Request(`https://trasy.cache/trasa/${typ}/${z}/${d}`);
  const mezipamet = caches.default;
  const ulozena = await mezipamet.match(klic);
  if (ulozena) return new Response(ulozena.body, { headers: { ...hlavicky, 'X-Mezipamet': 'ano' } });

  const mapy = new URL('https://api.mapy.com/v1/routing/route');
  mapy.searchParams.set('start', z);
  mapy.searchParams.set('end', d);
  mapy.searchParams.set('routeType', typ);
  mapy.searchParams.set('format', 'geojson');
  mapy.searchParams.set('lang', 'cs');
  const r = await fetch(mapy, { headers: { 'X-Mapy-Api-Key': env.MAPY_KLIC, 'Accept': 'application/json' } });
  if (!r.ok) return odpoved({ chyba: `Mapy.com odpověděly ${r.status}` }, 502);
  const data = await r.json();
  const body = data?.geometry?.geometry?.coordinates;
  if (!Array.isArray(body) || !(data.length >= 0)) return odpoved({ chyba: 'Trasu se nepodařilo najít' }, 404);
  const cara = [];
  for (const [lon, lat] of body) {
    const b = [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5];
    const p = cara[cara.length - 1];
    if (!p || p[0] !== b[0] || p[1] !== b[1]) cara.push(b);
  }
  const telo = JSON.stringify({ m: data.length, s: data.duration, cara });
  ctx.waitUntil(mezipamet.put(klic, new Response(telo, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=604800' } })));
  return new Response(telo, { headers: hlavicky });
}
