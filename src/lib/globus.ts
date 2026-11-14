// Glóbus na úvodní stránce, kreslený do canvasu. Stránka mu říká, kam se má dívat (podle scrollu),
// jak má státy obarvit a co zvýraznit. Pohyb je plynulý: pohled i barvy dojíždějí k cíli, glóbus jde
// roztočit prstem nebo myší (se setrvačností) a v klidu na úvodu se pomalu otáčí sám.
// Barvy jsou CSS proměnné z global.css, takže se glóbus sám přebarví v tmavém režimu.
import { geoOrthographic, geoPath, geoGraticule10, geoDistance, geoCentroid, geoInterpolate, geoBounds, geoContains } from 'd3-geo';
import { feature } from 'topojson-client';
import svet from '../data/svet.json';
import { barva as cssBarva, priZmeneTematu } from './tema';

export type Pohled = { lon: number; lat: number; k: number };
// Barva státu: název CSS proměnné bez -- (orange, navy, zeme, s1…s5) nebo hex
export type Obarveni = (a3: string) => string;
type Prvek = { a3: string; f: any; fMaly: any; c: [number, number]; r: number; b: [[number, number], [number, number]]; ringy: Float32Array[]; ringyMale: Float32Array[] };

const PRAHA: [number, number] = [14.42, 50.08];
const klidne = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);
// úhel do −180…180
const uhel = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

function rgb(c: string): [number, number, number] {
  c = c.trim();
  if (c.startsWith('#')) {
    const h = c.length === 4 ? c.slice(1).split('').map((x) => x + x).join('') : c.slice(1, 7);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const m = c.match(/[\d.]+/g);
  return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : [200, 200, 200];
}

// zacatek: čas (performance.now), od kterého běží úvodní animace oblouků; 0 = od načtení stránky,
// takže naváže na statický glóbus, který se kreslí stejně
export function spustGlobus(platno: HTMLCanvasElement, volby: { oblouky?: string[]; priSnimku?: () => void; zacatek?: number } = {}) {
  const ctx = platno.getContext('2d')!;
  const topo = svet.topo as any;
  const prvky: Prvek[] = (feature(topo, topo.objects.countries) as any).features
    .filter((f: any) => f.id && f.geometry)
    .map((f: any) => {
      const c = geoCentroid(f) as [number, number];
      let r = 0;
      const projdi = (g: any) => { for (const x of g) { if (typeof x[0] === 'number') r = Math.max(r, geoDistance(c, x)); else projdi(x); } };
      projdi(f.geometry.coordinates);
      // obrysy jako body na jednotkové kouli (x, y, z), jednou provždy; pro malý glóbus i zjednodušené
      // (body blíž než 0,45° se vynechají), ať se kreslí rychleji
      const polygony = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      const naKouli = (ring: [number, number][]) => {
        const a = new Float32Array(ring.length * 3);
        ring.forEach(([lo, la], k) => {
          const l = (lo * Math.PI) / 180, fi = (la * Math.PI) / 180;
          a[k * 3] = Math.cos(fi) * Math.cos(l); a[k * 3 + 1] = Math.cos(fi) * Math.sin(l); a[k * 3 + 2] = Math.sin(fi);
        });
        return a;
      };
      const zjednodus = (ring: [number, number][]) => {
        if (ring.length <= 8) return ring;
        const out = [ring[0]];
        for (let k = 1; k < ring.length - 1; k++) {
          const [a, b] = out[out.length - 1], [c, d] = ring[k];
          if (Math.abs(c - a) * Math.cos((d * Math.PI) / 180) + Math.abs(d - b) >= 0.45) out.push(ring[k]);
        }
        out.push(ring[ring.length - 1]);
        return out.length >= 4 ? out : ring;
      };
      const maly = polygony.map((poly: any) => poly.map(zjednodus));
      const ringy = polygony.flat().map(naKouli);
      const ringyMale = maly.flat().map(naKouli);
      const fMaly = { type: 'Feature', id: f.id, geometry: { type: 'MultiPolygon', coordinates: maly } };
      return { a3: f.id as string, f, fMaly, c, r: r + 0.02, b: geoBounds(f) as any, ringy, ringyMale };
    });
  const index = new Map(prvky.map((p, i) => [p.a3, i]));
  const cesko = prvky[index.get('CZE')!];
  const proj = geoOrthographic().precision(1);
  const cesta = geoPath(proj, ctx);
  const sfera = { type: 'Sphere' } as any;
  const mrizka = geoGraticule10();
  const sit: Float32Array[] = [];
  const bodSit = (lo: number, la: number, a: Float32Array, k: number) => {
    const l = (lo * Math.PI) / 180, fi = (la * Math.PI) / 180;
    a[k * 3] = Math.cos(fi) * Math.cos(l); a[k * 3 + 1] = Math.cos(fi) * Math.sin(l); a[k * 3 + 2] = Math.sin(fi);
  };
  for (let lo = -180; lo < 180; lo += 10) { const a = new Float32Array(81 * 3); for (let k = 0; k <= 80; k++) bodSit(lo, -80 + k * 2, a, k); sit.push(a); }
  for (let la = -80; la <= 80; la += 10) { const a = new Float32Array(181 * 3); for (let k = 0; k <= 180; k++) bodSit(-180 + k * 2, la, a, k); sit.push(a); }
  // ortografická projekce ručně: osa k pozorovateli (c) a osy východ (e) a sever (n) ve středu pohledu
  const osy = { cx: 0, cy: 0, cz: 0, ex: 0, ey: 0, nx: 0, ny: 0, nz: 0 };
  const nastavOsy = (lon: number, lat: number) => {
    const l = (lon * Math.PI) / 180, fi = (lat * Math.PI) / 180;
    osy.cx = Math.cos(fi) * Math.cos(l); osy.cy = Math.cos(fi) * Math.sin(l); osy.cz = Math.sin(fi);
    osy.ex = -Math.sin(l); osy.ey = Math.cos(l);
    osy.nx = -Math.sin(fi) * Math.cos(l); osy.ny = -Math.sin(fi) * Math.sin(l); osy.nz = Math.cos(fi);
  };

  // oblouky z Prahy do zemí ze série
  const oblouky = (volby.oblouky ?? []).map((a3) => {
    const p = prvky[index.get(a3) ?? -1];
    if (!p) return null;
    const i = geoInterpolate(PRAHA, p.c);
    return Array.from({ length: 41 }, (_, k) => i(k / 40));
  }).filter(Boolean) as [number, number][][];

  // --- barvy (z CSS proměnných, znovu při přepnutí vzhledu)
  let paleta = new Map<string, [number, number, number]>();
  let B: Record<string, string> = {};
  let leskSila = 0.38;
  const nactiBarvy = () => {
    paleta = new Map();
    for (const k of ['globus-1', 'globus-2', 'globus-3', 'sit-globusu', 'obrys', 'orange', 'navy', 'stin-barva', 'cream']) B[k] = cssBarva(k);
    leskSila = Number(cssBarva('lesk-sila')) || 0.38;
  };
  const tokenRgb = (t: string) => {
    let c = paleta.get(t);
    if (!c) { c = rgb(t.startsWith('#') || t.startsWith('rgb') ? t : cssBarva(t)); paleta.set(t, c); }
    return c;
  };
  nactiBarvy();

  const n = prvky.length;
  const barvyTed = new Float32Array(n * 3);
  const barvyCil = new Float32Array(n * 3);
  let obarveni: Obarveni = (a3) => (a3 === 'CZE' ? 'orange' : 'zeme');
  const nastavCil = (okamzite = false) => {
    for (let i = 0; i < n; i++) {
      const c = tokenRgb(obarveni(prvky[i].a3));
      barvyCil.set(c, i * 3);
      if (okamzite) barvyTed.set(c, i * 3);
    }
  };
  nastavCil(true);

  // --- stav
  let w = 0, h = 0, dpr = 1, r0 = 100;
  const ted: Pohled = { lon: 17, lat: 36, k: 1 };
  const cil: Pohled = { lon: 17, lat: 36, k: 1 };
  let obloukyTed = 1, obloukyCil = 1;
  // posun od uživatele (tažení, setrvačnost, samo-otáčení na úvodu)
  const uziv = { lon: 0, lat: 0 };
  let vahaUziv = 1;           // jak moc se posun uplatní (při přiblížení klesá, ať Evropa a Česko zůstanou uprostřed)
  let vlon = 0, vlat = 0;     // setrvačnost (stupně za sekundu)
  let tazeni = false;
  let posledniInterakce = 0;
  let unasenu = true;         // samo-otáčení povolené (jen na úvodu)
  // zamer = stát, na který se glóbus natočí (vlajka pod myší); zamerCil drží poslední, ať se plynule vrátí
  let zamer: string | null = null, zamerCil: string | null = null, zamerVaha = 0;
  // místo, kam se glóbus natáčí; dojíždí k zemi plynule, i když přejedeš z vlajky na vlajku
  const zp = { lon: 0, lat: 0 };
  const start = volby.zacatek ?? performance.now();
  let id: number | null = null, pred = 0;
  let videt = true;
  let casKresleni = 0, vynechat = false;

  function velikost() {
    const box = platno.getBoundingClientRect();
    // na telefonu stačí jemnost 1,5 násobku (ostrost skoro stejná, kreslení o polovinu rychlejší)
    dpr = Math.min(matchMedia('(pointer: coarse)').matches ? 1.5 : 2, window.devicePixelRatio || 1);
    w = Math.max(1, box.width); h = Math.max(1, box.height);
    platno.width = Math.round(w * dpr); platno.height = Math.round(h * dpr);
    r0 = Math.min(w, h) * 0.42;
    pozadej();
  }

  // výsledný pohled: cíl ze scrollu + posun uživatele + natočení na zvýrazněný stát
  function vysledny(): Pohled {
    let lon = ted.lon + uziv.lon * vahaUziv, lat = ted.lat + uziv.lat * vahaUziv;
    if (zamerVaha > 0.001) {
      lon += uhel(zp.lon - lon) * zamerVaha;
      lat += (zp.lat - lat) * zamerVaha;
    }
    return { lon, lat: Math.max(-80, Math.min(80, lat)), k: ted.k };
  }

  function kresli(t: number) {
    const p = vysledny();
    const r = r0 * p.k;
    const cx = w / 2, cy = h / 2;
    proj.scale(r).translate([cx, cy]).rotate([-p.lon, -p.lat]);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const zoom = Math.min(1, Math.max(0, (p.k - 1) / 1.2));

    // stín pod koulí (při přiblížení zmizí)
    if (zoom < 1) {
      const sy = cy + r * 1.1, sr = r * 0.78;
      const g = ctx.createRadialGradient(cx, sy, 0, cx, sy, sr);
      g.addColorStop(0, `rgba(${B['stin-barva']}, ${0.22 * (1 - zoom)})`);
      g.addColorStop(1, `rgba(${B['stin-barva']}, 0)`);
      ctx.save(); ctx.translate(cx, sy); ctx.scale(1, 0.1); ctx.translate(-cx, -sy);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, sy, sr, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }

    // moře
    const gm = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.32, 0, cx, cy, r * 1.15);
    gm.addColorStop(0, B['globus-1']); gm.addColorStop(0.62, B['globus-2']); gm.addColorStop(1, B['globus-3']);
    ctx.beginPath(); cesta(sfera); ctx.fillStyle = gm; ctx.fill();
    nastavOsy(p.lon, p.lat);
    ctx.beginPath();
    for (const a of sit) {
      let kresli = false;
      for (let k = 0; k < a.length; k += 3) {
        const z = a[k] * osy.cx + a[k + 1] * osy.cy + a[k + 2] * osy.cz;
        if (z < 0.02) { kresli = false; continue; }
        const x = cx + r * (a[k] * osy.ex + a[k + 1] * osy.ey);
        const y = cy - r * (a[k] * osy.nx + a[k + 1] * osy.ny + a[k + 2] * osy.nz);
        if (kresli) ctx.lineTo(x, y); else { ctx.moveTo(x, y); kresli = true; }
      }
    }
    ctx.strokeStyle = B['sit-globusu']; ctx.lineWidth = 0.7; ctx.stroke();

    // státy: mimo záběr se nepočítají. Státy stejné barvy se kreslí jednou cestou (Path2D),
    // takže místo stovek výplní a obrysů je jich jen pár.
    const mez = Math.asin(Math.min(1, Math.hypot(w, h) / 2 / r)) + 0.02;
    const stred: [number, number] = [p.lon, p.lat];
    ctx.lineJoin = 'round';
    const tl = Math.min(1.4, 0.5 + zoom * 0.6);
    const skupiny = new Map<string, Path2D>();
    const zjednodusene = r < 420;
    let ceskoP: Path2D | null = null, ceskoBarva = '', zamerP: Path2D | null = null;
    for (let i = 0; i < n; i++) {
      const pr = prvky[i];
      if (geoDistance(stred, pr.c) - pr.r > mez) continue;
      // barvy během přechodu zaokrouhlené, ať se skupiny slučují
      const b = `rgb(${barvyTed[i * 3] & ~3}, ${barvyTed[i * 3 + 1] & ~3}, ${barvyTed[i * 3 + 2] & ~3})`;
      // celý stát na přivrácené straně: rychle bez ořezu, jinak přes d3 (ořízne ho na okraji koule)
      const cely = geoDistance(stred, pr.c) + pr.r < Math.PI / 2 - 0.02;
      const obkresli = (cp: Path2D) => {
        if (!cely) { cesta.context(cp as any)(zjednodusene ? pr.fMaly : pr.f); return; }
        for (const a of zjednodusene ? pr.ringyMale : pr.ringy) {
          for (let k = 0; k < a.length; k += 3) {
            const x = cx + r * (a[k] * osy.ex + a[k + 1] * osy.ey);
            const y = cy - r * (a[k] * osy.nx + a[k + 1] * osy.ny + a[k + 2] * osy.nz);
            if (k === 0) cp.moveTo(x, y); else cp.lineTo(x, y);
          }
          cp.closePath();
        }
      };
      if (pr.a3 === 'CZE') { ceskoP = new Path2D(); obkresli(ceskoP); ceskoBarva = b; continue; }
      let cil = skupiny.get(b);
      if (!cil) { cil = new Path2D(); skupiny.set(b, cil); }
      obkresli(cil);
      if (zamer === pr.a3) { zamerP = new Path2D(); obkresli(zamerP); }
    }
    cesta.context(ctx);
    ctx.strokeStyle = B.obrys; ctx.lineWidth = tl;
    for (const [b, cp] of skupiny) { ctx.fillStyle = b; ctx.fill(cp, 'evenodd'); ctx.stroke(cp); }
    // zvýrazněný stát s oranžovým obrysem, Česko vždy navrch
    if (zamerP) { ctx.strokeStyle = B.orange; ctx.lineWidth = 2.2; ctx.stroke(zamerP); }
    if (ceskoP) { ctx.fillStyle = ceskoBarva; ctx.fill(ceskoP, 'evenodd'); ctx.strokeStyle = B.obrys; ctx.lineWidth = tl + 0.5; ctx.stroke(ceskoP); }

    // oblouky z Prahy (na začátku se vykreslí jeden po druhém)
    const s = (t - start) / 1000;
    if (obloukyTed > 0.01 && oblouky.length) {
      ctx.save();
      ctx.globalAlpha = obloukyTed;
      ctx.strokeStyle = B.orange; ctx.lineWidth = 2; ctx.lineCap = 'round';
      oblouky.forEach((body, i) => {
        const q = klidne() ? 1 : ease(Math.min(1, Math.max(0, (s - 0.6 - i * 0.25) / 2.4)));
        if (q <= 0) return;
        const k = Math.max(2, Math.round(q * (body.length - 1)) + 1);
        ctx.beginPath(); cesta({ type: 'LineString', coordinates: body.slice(0, k) } as any); ctx.stroke();
      });
      ctx.restore();
    }

    // Praha: tečka a tři pulzy na začátku
    if (geoDistance(stred, PRAHA) < Math.PI / 2 - 0.05) {
      const [px, py] = proj(PRAHA)!;
      if (!klidne()) {
        for (let k = 0; k < 3; k++) {
          const q = (s - 1.2 - k * 2.4) / 2.4;
          if (q > 0 && q < 1) {
            ctx.beginPath(); ctx.arc(px, py, 7 * (1 + q * 2.4), 0, Math.PI * 2);
            ctx.fillStyle = B.orange; ctx.globalAlpha = 0.5 * (1 - q); ctx.fill(); ctx.globalAlpha = 1;
          }
        }
      }
      if (zoom < 0.9) {
        ctx.beginPath(); ctx.arc(px, py, 4.5, 0, Math.PI * 2);
        ctx.globalAlpha = 1 - zoom; ctx.fillStyle = B.orange; ctx.fill();
        ctx.lineWidth = 1.6; ctx.strokeStyle = B.obrys; ctx.stroke(); ctx.globalAlpha = 1;
      }
    }

    // lesk a obrys koule
    const gl = ctx.createRadialGradient(cx - r * 0.32, cy - r * 0.48, 0, cx, cy, r * 1.4);
    gl.addColorStop(0, `rgba(255, 255, 255, ${leskSila * (1 - zoom * 0.7)})`);
    gl.addColorStop(0.45, 'rgba(255, 255, 255, 0.05)');
    gl.addColorStop(1, `rgba(27, 42, 74, ${0.16 * (1 - zoom)})`);
    ctx.beginPath(); cesta(sfera); ctx.fillStyle = gl; ctx.fill();
    if (zoom < 1) { ctx.globalAlpha = 1 - zoom; ctx.strokeStyle = 'rgba(27, 42, 74, 0.18)'; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1; }

  }

  // --- smyčka: běží, jen dokud se něco hýbe
  function snimek(t: number) {
    id = null;
    const dt = Math.min(0.05, Math.max(0.001, (t - pred) / 1000));
    pred = t;
    const okamzite = klidne();
    let hybe = false;
    const a = okamzite ? 1 : 1 - Math.exp(-dt / 0.14);

    // pohled ke scrollu
    const dlon = uhel(cil.lon - ted.lon);
    if (Math.abs(dlon) > 0.01 || Math.abs(cil.lat - ted.lat) > 0.01 || Math.abs(cil.k / ted.k - 1) > 0.0005) {
      ted.lon += dlon * a; ted.lat += (cil.lat - ted.lat) * a;
      ted.k = Math.exp(Math.log(ted.k) + (Math.log(cil.k) - Math.log(ted.k)) * a);
      hybe = true;
    } else { ted.lon = cil.lon; ted.lat = cil.lat; ted.k = cil.k; }

    // posun uživatele: tažení, setrvačnost, samo-otáčení, návrat při přiblížení
    if (!tazeni) {
      if (Math.abs(vlon) > 0.5 || Math.abs(vlat) > 0.5) {
        uziv.lon += vlon * dt; uziv.lat = Math.max(-50, Math.min(50, uziv.lat + vlat * dt));
        const u = Math.pow(0.05, dt); vlon *= u; vlat *= u; hybe = true;
      } else { vlon = 0; vlat = 0; }
      const klid = (t - posledniInterakce) / 1000;
      if (unasenu && !okamzite && klid > 2.5 && ted.k < 1.05) {
        const rozjezd = Math.min(1, (klid - 2.5) / 2);
        uziv.lon += 3.2 * rozjezd * dt; hybe = true;
      }
      // při přiblížení se posun plynule vrátí, ať je cíl uprostřed
      const cilVaha = ted.k > 1.15 ? 0 : 1;
      if (Math.abs(vahaUziv - cilVaha) > 0.001) { vahaUziv += (cilVaha - vahaUziv) * (1 - Math.exp(-dt / 0.35)); hybe = true; }
      if (vahaUziv < 0.01 && (uziv.lon || uziv.lat)) { uziv.lon = 0; uziv.lat = 0; }
      uziv.lat *= Math.pow(0.6, dt);
    }
    if (zamerCil && index.has(zamerCil)) {
      const c = prvky[index.get(zamerCil)!].c;
      const az = okamzite ? 1 : 1 - Math.exp(-dt / 0.22);
      const dl = uhel(c[0] - zp.lon), cLat = Math.max(-60, Math.min(60, c[1]));
      if (Math.abs(dl) > 0.02 || Math.abs(cLat - zp.lat) > 0.02) { zp.lon += dl * az; zp.lat += (cLat - zp.lat) * az; hybe = true; }
    }
    const cz = zamer ? 1 : 0;
    if (Math.abs(zamerVaha - cz) > 0.001) { zamerVaha += (cz - zamerVaha) * (okamzite ? 1 : 1 - Math.exp(-dt / 0.3)); hybe = true; }

    // barvy a oblouky
    const ab = okamzite ? 1 : 1 - Math.exp(-dt / 0.18);
    let barvyHybe = false;
    for (let i = 0; i < barvyTed.length; i++) {
      const d = barvyCil[i] - barvyTed[i];
      if (Math.abs(d) > 0.5) { barvyTed[i] += d * ab; barvyHybe = true; } else barvyTed[i] = barvyCil[i];
    }
    if (Math.abs(obloukyCil - obloukyTed) > 0.005) { obloukyTed += (obloukyCil - obloukyTed) * ab; hybe = true; } else obloukyTed = obloukyCil;
    const uvod = (t - start) / 1000 < 9 && !okamzite;

    vynechat = !vynechat && casKresleni > 11;
    if (!vynechat) {
      const t0 = performance.now();
      kresli(t);
      casKresleni = casKresleni * 0.85 + (performance.now() - t0) * 0.15;
      volby.priSnimku?.();
    }
    if ((hybe || barvyHybe || uvod) && videt && !document.hidden) id = requestAnimationFrame(snimek);
  }
  function pozadej() {
    if (id === null && videt) { pred = performance.now(); id = requestAnimationFrame(snimek); }
  }

  // --- tažení myší nebo prstem (na telefonu jen do stran, svisle se dál scrolluje stránkou)
  let x0 = 0, y0 = 0, posun = 0, kliknuti = true;
  const mereni: { x: number; y: number; t: number }[] = [];
  platno.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    tazeni = true; kliknuti = true; posun = 0;
    x0 = e.clientX; y0 = e.clientY; vlon = vlat = 0;
    mereni.length = 0; mereni.push({ x: x0, y: y0, t: performance.now() });
    posledniInterakce = performance.now();
    platno.setPointerCapture(e.pointerId);
  });
  platno.addEventListener('pointermove', (e) => {
    if (!tazeni) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    x0 = e.clientX; y0 = e.clientY;
    posun += Math.abs(dx) + Math.abs(dy);
    if (posun > 6) kliknuti = false;
    const st = (180 / Math.PI) / (r0 * ted.k);
    uziv.lon -= dx * st;
    if (e.pointerType === 'mouse') uziv.lat = Math.max(-50, Math.min(50, uziv.lat + dy * st));
    vahaUziv = 1;
    const tt = performance.now();
    mereni.push({ x: e.clientX, y: e.clientY, t: tt });
    while (mereni.length > 2 && tt - mereni[0].t > 100) mereni.shift();
    posledniInterakce = tt;
    pozadej();
  });
  const pust = (e: PointerEvent) => {
    if (!tazeni) return;
    tazeni = false;
    const a = mereni[0], b = mereni.at(-1);
    if (a && b && performance.now() - b.t < 80 && b.t > a.t) {
      const st = (180 / Math.PI) / (r0 * ted.k);
      vlon = -((b.x - a.x) / ((b.t - a.t) / 1000)) * st;
      vlat = e.pointerType === 'mouse' ? ((b.y - a.y) / ((b.t - a.t) / 1000)) * st : 0;
      vlon = Math.max(-400, Math.min(400, vlon)); vlat = Math.max(-200, Math.min(200, vlat));
    }
    posledniInterakce = performance.now();
    pozadej();
  };
  platno.addEventListener('pointerup', pust);
  platno.addEventListener('pointercancel', (e) => { kliknuti = false; pust(e); });

  // --- viditelnost a velikost
  new ResizeObserver(velikost).observe(platno);
  new IntersectionObserver(([z]) => { videt = z.isIntersecting; if (videt) pozadej(); }).observe(platno);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pozadej(); });
  priZmeneTematu(() => { nactiBarvy(); nastavCil(true); pozadej(); });
  velikost();

  // Přiblížení, při kterém Česko zabere zadaný podíl šířky plátna
  function zoomNaCesko(podil: number) {
    const [[a, b], [c, d]] = cesko.b;
    const stredC: [number, number] = [(a + c) / 2, (b + d) / 2];
    proj.scale(r0).translate([w / 2, h / 2]).rotate([-stredC[0], -stredC[1]]);
    const [[x0, y0], [x1, y1]] = geoPath(proj).bounds(cesko.f);
    const k = Math.min((w * podil) / (x1 - x0), (h * podil) / (y1 - y0));
    return { lon: stredC[0], lat: stredC[1], k };
  }

  return {
    // cíl pohledu (ze scrollu); okamzite = bez dojezdu
    nastav(p: Pohled, okamzite = false) {
      Object.assign(cil, p);
      if (okamzite) Object.assign(ted, p);
      pozadej();
    },
    obarvi(o: Obarveni, okamzite = false) { obarveni = o; nastavCil(okamzite); pozadej(); },
    oblouky(viditelne: boolean) { obloukyCil = viditelne ? 1 : 0; pozadej(); },
    zamer(a3: string | null) {
      // první zaměření začne tam, kam se glóbus zrovna dívá
      if (a3 && zamerVaha < 0.01) { zp.lon = ted.lon + uziv.lon * vahaUziv; zp.lat = ted.lat + uziv.lat * vahaUziv; }
      zamer = a3; if (a3) zamerCil = a3;
      posledniInterakce = performance.now(); pozadej();
    },
    samoOtaceni(ano: boolean) { unasenu = ano; pozadej(); },
    zoomNaCesko,
    // Obdélník Česka v pixelech plátna při právě vykresleném pohledu
    obdelnikCeska() {
      const [[x0, y0], [x1, y1]] = geoPath(proj).bounds(cesko.f);
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    },
    meritko: () => ted.k,
    // Bod [lon, lat] v pixelech plátna při právě vykresleném pohledu
    bod: (lon: number, lat: number) => proj([lon, lat]) as [number, number] | null,
    kliknuti: () => kliknuti,
    // Stát pod bodem plátna (pro bublinu s názvem)
    statNa(x: number, y: number): string | null {
      const ll = proj.invert?.([x, y]);
      if (!ll || geoDistance(ll as [number, number], [vysledny().lon, vysledny().lat]) > Math.PI / 2) return null;
      for (const p of prvky) {
        const [[a, b], [c, d]] = p.b;
        const vLon = a <= c ? ll[0] >= a && ll[0] <= c : ll[0] >= a || ll[0] <= c;
        if (!vLon || ll[1] < b || ll[1] > d) continue;
        if (geoContains(p.f, ll as [number, number])) return p.a3;
      }
      return null;
    },
    prekresli: pozadej,
  };
}

export type Globus = ReturnType<typeof spustGlobus>;
