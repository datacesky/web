// Slepá mapa pro hru Vlajky světa: mapa světa v canvasu, kterou jde posouvat a přibližovat
// (myší, kolečkem, prsty), a ťuknutím se vybírá stát.
//
// Jak se řeší malé státy na telefonu:
// - Státy, které jsou při daném přiblížení menší než pár pixelů, se kreslí jako kroužek se stálou velikostí.
// - Ťuknutí se přichytí k nejbližšímu státu v okolí prstu (ne jen přesně do obrysu).
// - Když je v okolí prstu víc malých států a není jasné, který hráč myslel, mapa se tam sama přiblíží
//   („chytré přiblížení“) a hráč ťukne znovu. Nikdy tak neodpoví omylem.
//
// Souřadnice: mapa z public/data/hra-vlajky.json je Natural Earth (d3 geoNaturalEarth1) 10 000 × 5 200.
// Kamera = měřítko s (CSS px na jednotku mapy) a bod mapy ve středu plátna (cx, cy).
import { geoNaturalEarth1, geoNaturalEarth1Raw, geoDistance } from 'd3-geo';
import { pruzina, setrvacnost, merickoRychlosti } from './pohyb';
import { barva } from './tema';

/** 0 = ještě nehádaný, 1–3 = nalezen na tolikátý pokus, 4 = nenalezen */
export type StavStatu = 0 | 1 | 2 | 3 | 4;
export type VstupStatu = { c: string; d?: string | null; pt: [number, number]; ar: number };
export type Box = [number, number, number, number];
export type Okraje = { nahore?: number; dole?: number; vlevo?: number; vpravo?: number };

type Stat = {
  c: string; path: Path2D | null; kruhy: number[][]; lod: (Path2D | null)[]; box: Box; pt: [number, number]; ar: number;
  aktivni: boolean; stav: StavStatu; kruh: { x: number; y: number } | null;
};
type Kandidat = { st: Stat; d: number; uvnitr: boolean; velikost: number; kruh: boolean };
type Efekt = { c: string; typ: 'chyba' | 'ok' | 'ukaz'; t0: number; dur: number; x?: number; y?: number };
type Stitek = { el: HTMLElement; x: number; y: number };

export type Volby = {
  W: number; H: number; other: string;
  staty: VstupStatu[];
  /** Státy, které leží za datovou hranicí (Samoa, Tonga): přesunou se za Fidži, ať je Oceánie pohromadě */
  preklopit?: string[];
  /** Hráč jednoznačně ťukl na aktivní stát. mx, my = místo ťuknutí v souřadnicích mapy. */
  naTuk: (c: string, mx: number, my: number) => void;
  /** Ťuknutí nebylo jednoznačné a mapa se přiblížila */
  naPriblizeni?: () => void;
  /** Smí kolečko myši přibližovat bez Ctrl (na celé obrazovce ano, ve stránce jen s Ctrl) */
  kolecko?: () => boolean;
  /** Ukáže nápovědu „přibližuj s Ctrl“ */
  napovedaKolecka?: () => void;
};

export type SlepaMapa = ReturnType<typeof slepaMapa>;

const R_KRUH = 7; // poloměr kroužku malého státu v CSS px
const PRAH_KRUHU = 9; // stát menší než tolik px (odmocnina z plochy) se kreslí kroužkem…
const MIKRO = 30; // …ale jen opravdu malý stát (odmocnina z plochy v jednotkách mapy: Lucembursko, Malta, Katar, ostrovy).
// Větší státy (Belgie, Slovinsko) kroužek nedostanou ani na celém světě, tam pomůže chytré přiblížení.

export function slepaMapa(obal: HTMLElement, o: Volby) {
  const { W, H } = o;
  const platno = document.createElement('canvas');
  platno.className = 'sm-platno';
  const vrstva = document.createElement('div');
  vrstva.className = 'sm-stitky';
  obal.prepend(vrstva);
  obal.prepend(platno);
  const ctx = platno.getContext('2d')!;

  /* ---------- projekce (kvůli vzdálenostem v km a překlopení přes datovou hranici) ---------- */
  const proj = geoNaturalEarth1().fitSize([W, H], { type: 'Sphere' });
  const K = proj.scale(), [T0x, T0y] = proj.translate();
  const doGeo = (x: number, y: number) => proj.invert!([x, y]);

  /* ---------- geometrie ---------- */
  // Cesty mají jen příkazy M (absolutně), l (relativně) a z
  function cesta(kruhy: number[][]) {
    const p = new Path2D();
    for (const k of kruhy) {
      p.moveTo(k[0], k[1]);
      for (let i = 2; i < k.length; i += 2) p.lineTo(k[i], k[i + 1]);
      p.closePath();
    }
    return p;
  }
  function rozeber(d: string): number[][] {
    const t = d.match(/[MmLlZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
    const kruhy: number[][] = [];
    let k: number[] = [], x = 0, y = 0, cmd = 'M';
    for (let i = 0; i < t.length; i++) {
      const s = t[i];
      if (/[MmLlZz]/.test(s)) {
        if (s === 'z' || s === 'Z') { if (k.length) kruhy.push(k); k = []; }
        else cmd = s;
        continue;
      }
      const a = +s, b = +t[++i];
      if (cmd === 'M') { if (k.length) kruhy.push(k); k = []; x = a; y = b; cmd = 'L'; }
      else if (cmd === 'm') { if (k.length) kruhy.push(k); k = []; x += a; y += b; cmd = 'l'; }
      else if (cmd === 'L') { x = a; y = b; }
      else { x += a; y += b; }
      k.push(x, y);
    }
    if (k.length) kruhy.push(k);
    return kruhy;
  }
  // Bod posunutý o 360° na východ (pro ostrovy těsně za datovou hranicí)
  function preklop(x: number, y: number): [number, number] {
    const g = doGeo(x, y);
    if (!g || !isFinite(g[0])) return [x + W, y];
    const lam = ((g[0] < 0 ? g[0] + 360 : g[0]) * Math.PI) / 180, phi = (g[1] * Math.PI) / 180;
    const [rx, ry] = geoNaturalEarth1Raw(lam, phi);
    return [T0x + K * rx, T0y - K * ry];
  }
  const preklopit = new Set(o.preklopit ?? []);
  const staty: Stat[] = o.staty.map((v) => {
    let kruhy = v.d ? rozeber(v.d) : [];
    let pt = v.pt;
    if (preklopit.has(v.c)) {
      kruhy = kruhy.map((k) => { const n: number[] = []; for (let i = 0; i < k.length; i += 2) n.push(...preklop(k[i], k[i + 1])); return n; });
      pt = preklop(pt[0], pt[1]);
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const k of kruhy) for (let i = 0; i < k.length; i += 2) { x0 = Math.min(x0, k[i]); x1 = Math.max(x1, k[i]); y0 = Math.min(y0, k[i + 1]); y1 = Math.max(y1, k[i + 1]); }
    if (!kruhy.length) { x0 = x1 = pt[0]; y0 = y1 = pt[1]; }
    const path = kruhy.length ? cesta(kruhy) : null;
    return { c: v.c, path, kruhy, lod: [path], box: [x0, y0, x1, y1], pt, ar: v.ar, aktivni: false, stav: 0, kruh: null };
  });
  const podle = new Map(staty.map((s) => [s.c, s]));
  const ostatniKruhy = rozeber(o.other);
  const ostatniLod: Path2D[] = [cesta(ostatniKruhy)];

  /* ---------- zjednodušené obrysy pro oddálenou mapu ----------
     Při pohledu na celý svět má pobřeží tisíce bodů menších než pixel. Kreslí se proto zjednodušená verze
     (Douglas–Peucker) s tolerancí pod půl pixelu; plné obrysy jen při přiblížení. Na ťukání se bere vždy plný obrys. */
  const TOL = [0, 1.5, 4, 10, 24]; // tolerance v jednotkách mapy pro úrovně 0–4
  function zjednodus(k: number[], tol: number): number[] | null {
    const n = k.length / 2;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < k.length; i += 2) { x0 = Math.min(x0, k[i]); x1 = Math.max(x1, k[i]); y0 = Math.min(y0, k[i + 1]); y1 = Math.max(y1, k[i + 1]); }
    if (Math.max(x1 - x0, y1 - y0) < tol) return null; // ostrůvek menší než tolerance zmizí
    if (n <= 4) return k;
    const drz = new Uint8Array(n); drz[0] = drz[n - 1] = 1;
    const zas = [0, n - 1], t2 = tol * tol;
    while (zas.length) {
      const b = zas.pop()!, a = zas.pop()!;
      const ax = k[2 * a], ay = k[2 * a + 1], dx = k[2 * b] - ax, dy = k[2 * b + 1] - ay, L = dx * dx + dy * dy;
      let nej = 0, idx = -1;
      for (let i = a + 1; i < b; i++) {
        const px = k[2 * i] - ax, py = k[2 * i + 1] - ay;
        const d = L === 0 ? px * px + py * py : (px * dy - py * dx) ** 2 / L;
        if (d > nej) { nej = d; idx = i; }
      }
      if (nej > t2 && idx > 0) { drz[idx] = 1; zas.push(a, idx, idx, b); }
    }
    const out: number[] = [];
    for (let i = 0; i < n; i++) if (drz[i]) out.push(k[2 * i], k[2 * i + 1]);
    return out.length >= 6 ? out : null;
  }
  const zjednodusene = (kruhy: number[][], u: number) => cesta(kruhy.map((k) => zjednodus(k, TOL[u])).filter((k): k is number[] => !!k));
  function cestaStatu(st: Stat, u: number) {
    if (st.lod[u] === undefined) st.lod[u] = st.kruhy.length ? zjednodusene(st.kruhy, u) : null;
    return st.lod[u];
  }
  const cestaOstatnich = (u: number) => (ostatniLod[u] ??= zjednodusene(ostatniKruhy, u));
  // Úroveň podle měřítka: tolerance pod ~0,6 px, při posouvání a animaci o stupeň hrubší
  const urovenPro = (m: number, hrube: boolean) => { let u = 0; for (let i = 1; i < TOL.length; i++) if (TOL[i] * m <= (hrube ? 1.4 : 0.6)) u = i; return u; };
  const MEZE = { x0: 0, x1: W * 1.06, y0: H * 0.04, y1: H * 0.96 };

  /* ---------- barvy (CSS proměnné, mění se s tmavým režimem) ---------- */
  let B: Record<string, string> = {};
  const nactiBarvy = () => {
    B = {
      more: barva('sm-more'), aktivni: barva('sm-aktivni'), neaktivni: barva('sm-neaktivni'), hranice: barva('sm-hranice'),
      hraniceSlaba: barva('sm-hranice-slaba'), hover: barva('sm-hover'), obrys: barva('obrys'), navy: barva('navy'),
      s1: barva('sm-1'), s2: barva('sm-2'), s3: barva('sm-3'), s4: barva('sm-4'),
    };
  };
  nactiBarvy();
  const barvaStavu = (s: StavStatu) => (s ? B['s' + s] : B.aktivni);

  /* ---------- skládané cesty: jedna výplň pro všechny státy stejné barvy ---------- */
  type Slozeni = { neaktivni: Path2D; aktivni: Path2D; stavy: Path2D[]; barevne: Path2D };
  let slozeni: Slozeni[] = [];
  const prestav = () => { slozeni = []; kresli(); };
  function slozeniCest(u: number) {
    if (slozeni[u]) return slozeni[u];
    const s: Slozeni = { neaktivni: new Path2D(), aktivni: new Path2D(), stavy: [1, 2, 3, 4].map(() => new Path2D()), barevne: new Path2D() };
    s.neaktivni.addPath(cestaOstatnich(u));
    for (const st of staty) {
      const p = cestaStatu(st, u);
      if (!p) continue;
      if (!st.aktivni) s.neaktivni.addPath(p);
      else if (!st.stav) s.aktivni.addPath(p);
      else { s.stavy[st.stav - 1].addPath(p); s.barevne.addPath(p); }
    }
    return (slozeni[u] = s);
  }

  /* ---------- kamera ---------- */
  let w = 0, h = 0, dpr = 1;
  let ls = Math.log(0.05), cx = W / 2, cy = H / 2; // ln(měřítko), střed
  let sMin = 0.02, sMax = 2.6;
  let hranice = true;
  let hover: string | null = null;
  let upraveno = false; // hráč sám posouval nebo přibližoval
  let cekajiciOblast: { box: Box; okraje: Okraje } | null = null;
  let posledniOblast: { box: Box; okraje: Okraje } | null = null;
  const s = () => Math.exp(ls);
  const doMapy = (x: number, y: number): [number, number] => [cx + (x - w / 2) / s(), cy + (y - h / 2) / s()];
  const naPlatno = (x: number, y: number): [number, number] => [(x - cx) * s() + w / 2, (y - cy) * s() + h / 2];

  // Vrátí, jestli se narazilo na okraj v ose x / y (pro doběh setrvačností)
  function omez(): [boolean, boolean] {
    ls = Math.min(Math.log(sMax), Math.max(Math.log(sMin), ls));
    const nx = Math.min(MEZE.x1, Math.max(MEZE.x0, cx)), ny = Math.min(MEZE.y1, Math.max(MEZE.y0, cy));
    const r: [boolean, boolean] = [nx !== cx, ny !== cy];
    cx = nx; cy = ny;
    return r;
  }
  const kamera = pruzina(() => [ls, cx, cy], ([a, b, c]) => { ls = a; cx = b; cy = c; omez(); kresli(); }, 0.5);
  let dobeh: { zastav: () => void; bezi: () => boolean } | null = null;
  const zastavPohyb = () => { kamera.zastav(); dobeh?.zastav(); dobeh = null; };
  const omezCil = (a: number, b: number, c: number) => [
    Math.min(Math.log(sMax), Math.max(Math.log(sMin), a)), Math.min(MEZE.x1, Math.max(MEZE.x0, b)), Math.min(MEZE.y1, Math.max(MEZE.y0, c)),
  ];
  function jedNa(a: number, b: number, c: number, plynule = true) {
    const [na, nb, nc] = omezCil(a, b, c);
    dobeh?.zastav(); dobeh = null;
    if (!plynule) { kamera.zastav(); ls = na; cx = nb; cy = nc; omez(); kresli(); return; }
    kamera.k([na, nb, nc]);
  }
  // Měřítko, při kterém se obdélník vejde do volné plochy (bez překryvů nahoře a dole)
  function meritkoPro(box: Box, ok: Okraje, vyplnit = true) {
    const vw = Math.max(60, w - (ok.vlevo ?? 0) - (ok.vpravo ?? 0)), vh = Math.max(60, h - (ok.nahore ?? 0) - (ok.dole ?? 0));
    const bw = Math.max(40, box[2] - box[0]), bh = Math.max(40, box[3] - box[1]);
    const vejit = Math.min(vw / bw, vh / bh), pokryt = Math.max(vw / bw, vh / bh);
    // Široká oblast na úzkém telefonu by byla jen tenký pruh: trochu přiblížit a nechat posouvat do stran
    return vyplnit ? Math.min(vejit * 1.45, pokryt * 0.92, Math.max(vejit, pokryt * 0.6)) : vejit;
  }
  function naObdelnik(box: Box, ok: Okraje = {}, plynule = true, vyplnit = true) {
    if (!w || !h) { cekajiciOblast = { box, okraje: ok }; return; }
    const m = meritkoPro(box, ok, vyplnit);
    const bx = (box[0] + box[2]) / 2, by = (box[1] + box[3]) / 2;
    // střed obdélníku do středu volné plochy
    const dx = ((ok.vlevo ?? 0) - (ok.vpravo ?? 0)) / 2, dy = ((ok.nahore ?? 0) - (ok.dole ?? 0)) / 2;
    jedNa(Math.log(m), bx - dx / m, by - dy / m, plynule);
  }
  function kolemBodu(ns: number, px: number, py: number, plynule = false) {
    const [mx, my] = doMapy(px, py);
    ns = Math.min(sMax, Math.max(sMin, ns));
    jedNa(Math.log(ns), mx - (px - w / 2) / ns, my - (py - h / 2) / ns, plynule);
  }

  /* ---------- efekty a štítky ---------- */
  let efekty: Efekt[] = [];
  const stitky: Stitek[] = [];
  let animace = 0;
  function efekt(c: string, typ: Efekt['typ'], misto?: [number, number], dur = typ === 'ukaz' ? 2400 : typ === 'chyba' ? 750 : 650) {
    efekty = efekty.filter((e) => !(e.c === c && e.typ === typ));
    efekty.push({ c, typ, t0: performance.now(), dur, x: misto?.[0], y: misto?.[1] });
    if (!animace) animace = requestAnimationFrame(smycka);
  }
  function smycka() {
    animace = 0;
    const t = performance.now();
    efekty = efekty.filter((e) => t - e.t0 < e.dur);
    kresliHned();
    if (efekty.length) animace = requestAnimationFrame(smycka);
  }
  function stitek(text: string, x: number, y: number, typ: 'ok' | 'chyba' | 'info' = 'info', ms = 1600) {
    const el = document.createElement('div');
    el.className = 'sm-stitek sm-stitek--' + typ;
    const span = document.createElement('span');
    span.textContent = text;
    el.appendChild(span);
    vrstva.appendChild(el);
    const st = { el, x, y };
    stitky.push(st);
    umistiStitek(st);
    window.setTimeout(() => {
      el.classList.add('mizi');
      window.setTimeout(() => { el.remove(); const i = stitky.indexOf(st); if (i >= 0) stitky.splice(i, 1); }, 260);
    }, ms);
  }
  function umistiStitek(st: Stitek) {
    const [x, y] = naPlatno(st.x, st.y);
    st.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }

  /* ---------- kreslení ---------- */
  let naplanovano = 0;
  function kresli() { if (!naplanovano) naplanovano = requestAnimationFrame(() => { naplanovano = 0; kresliHned(); }); }
  function kresliHned() {
    if (!w || !h) return;
    const m = s(), tx = w / 2 - cx * m, ty = h / 2 - cy * m;
    const u = urovenPro(m, prsty.size > 0 || kamera.bezi() || !!dobeh?.bezi());
    const sl = slozeniCest(u);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = B.more;
    ctx.fillRect(0, 0, w, h);
    ctx.setTransform(dpr * m, 0, 0, dpr * m, dpr * tx, dpr * ty);
    ctx.lineJoin = 'round';
    ctx.fillStyle = B.neaktivni; ctx.fill(sl.neaktivni);
    ctx.fillStyle = B.aktivni; ctx.fill(sl.aktivni);
    sl.stavy.forEach((p, i) => { ctx.fillStyle = B['s' + (i + 1)]; ctx.fill(p); });
    const t = performance.now();
    const hv = hover ? podle.get(hover) : null;
    const hvp = hv?.aktivni ? cestaStatu(hv, u) : null;
    if (hvp && !hv!.stav) { ctx.fillStyle = B.hover; ctx.fill(hvp); }
    // Efekty na plochách států
    for (const e of efekty) {
      const st = podle.get(e.c), ep = st && cestaStatu(st, u); if (!ep) continue;
      const p = (t - e.t0) / e.dur;
      if (e.typ === 'chyba') { ctx.globalAlpha = 0.75 * (1 - p); ctx.fillStyle = B.s4; ctx.fill(ep); }
      // odhalený stát bliká mezi červenou (už je vybarvený) a bílou, skončí červeně
      else if (e.typ === 'ukaz') { ctx.globalAlpha = Math.max(0, Math.cos(p * Math.PI * 7)) * 0.9; ctx.fillStyle = B.aktivni; ctx.fill(ep); }
      ctx.globalAlpha = 1;
    }
    // Hranice: tenké čáry stálé tloušťky. Bez hranic jen kolem už vybarvených států.
    if (hranice) {
      ctx.strokeStyle = B.hraniceSlaba; ctx.lineWidth = 0.7 / m; ctx.stroke(sl.neaktivni);
      ctx.strokeStyle = B.hranice; ctx.lineWidth = 0.8 / m;
      ctx.stroke(sl.aktivni);
    }
    ctx.strokeStyle = B.obrys; ctx.lineWidth = (hranice ? 0.9 : 1.1) / m; ctx.stroke(sl.barevne);
    if (hvp && !hranice) { ctx.strokeStyle = B.hranice; ctx.lineWidth = 1 / m; ctx.stroke(hvp); }

    // Kroužky malých států (ve stálé velikosti) a kroužky efektů
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const st of staty) {
      st.kruh = null;
      if (!st.aktivni) continue;
      if (st.path && (Math.sqrt(st.ar) >= MIKRO || Math.sqrt(st.ar) * m >= PRAH_KRUHU)) continue;
      const x = st.pt[0] * m + tx, y = st.pt[1] * m + ty;
      if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
      st.kruh = { x, y };
      const naMysi = hover === st.c && !st.stav;
      ctx.beginPath(); ctx.arc(x, y, R_KRUH + (naMysi ? 1.5 : 0), 0, Math.PI * 2);
      ctx.fillStyle = naMysi ? B.hover : barvaStavu(st.stav); ctx.fill();
      ctx.lineWidth = 1.6; ctx.strokeStyle = B.navy; ctx.stroke();
    }
    for (const e of efekty) {
      const st = podle.get(e.c); if (!st) continue;
      const p = Math.min(1, (t - e.t0) / e.dur);
      const x = (e.x ?? st.pt[0]) * m + tx, y = (e.y ?? st.pt[1]) * m + ty;
      if (e.typ === 'ok') {
        ctx.beginPath(); ctx.arc(x, y, 8 + p * 34, 0, Math.PI * 2);
        ctx.globalAlpha = 1 - p; ctx.lineWidth = 3; ctx.strokeStyle = B.s1; ctx.stroke(); ctx.globalAlpha = 1;
      } else if (e.typ === 'ukaz') {
        // dvě vlny kolem státu, ať je vidět i na celé mapě
        const r0 = st.path ? Math.max(14, (Math.max(st.box[2] - st.box[0], st.box[3] - st.box[1]) * m) / 2 + 6) : 12;
        for (const f of [0, 0.5]) {
          const q = ((t - e.t0) / 1100 + f) % 1;
          ctx.beginPath(); ctx.arc(x, y, r0 + q * 40, 0, Math.PI * 2);
          ctx.globalAlpha = (1 - q) * (p < 0.85 ? 1 : (1 - p) / 0.15); ctx.lineWidth = 3; ctx.strokeStyle = B.navy; ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
    for (const st of stitky) umistiStitek(st);
  }

  /* ---------- velikost plátna ---------- */
  function velikost() {
    const r = obal.getBoundingClientRect();
    const nw = Math.round(r.width), nh = Math.round(r.height);
    if (!nw || !nh) return;
    const prvni = !w || !h;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = nw; h = nh;
    platno.width = Math.round(w * dpr); platno.height = Math.round(h * dpr);
    platno.style.width = w + 'px'; platno.style.height = h + 'px';
    sMin = Math.min(w / W, h / (H * 0.85)) * 0.9;
    sMax = Math.max(2.6, sMin * 60);
    if (cekajiciOblast) { const c = cekajiciOblast; cekajiciOblast = null; naObdelnik(c.box, c.okraje, false); return; }
    if ((prvni || !upraveno) && posledniOblast) { naObdelnik(posledniOblast.box, posledniOblast.okraje, false); return; }
    omez(); kresliHned();
  }
  const ro = new ResizeObserver(velikost);
  ro.observe(obal);

  /* ---------- hledání státu pod prstem ---------- */
  function vNastaveni(fn: () => void) {
    const m = s();
    ctx.save();
    ctx.setTransform(dpr * m, 0, 0, dpr * m, dpr * (w / 2 - cx * m), dpr * (h / 2 - cy * m));
    fn();
    ctx.restore();
  }
  function kandidati(x: number, y: number, T: number): Kandidat[] {
    const m = s(), [mx, my] = doMapy(x, y), tm = T / m, out: Kandidat[] = [];
    vNastaveni(() => {
      for (const st of staty) {
        if (!st.aktivni) continue;
        const velikost = Math.sqrt(st.ar) * m;
        if (st.kruh) {
          const d = Math.hypot(x - st.kruh.x, y - st.kruh.y) - R_KRUH;
          if (d <= T) out.push({ st, d: Math.max(0, d), uvnitr: d <= 0, velikost: Math.min(velikost, 6), kruh: true });
          continue;
        }
        if (!st.path) continue;
        const b = st.box;
        if (mx < b[0] - tm || mx > b[2] + tm || my < b[1] - tm || my > b[3] + tm) continue;
        if (ctx.isPointInPath(st.path, x * dpr, y * dpr)) { out.push({ st, d: 0, uvnitr: true, velikost, kruh: false }); continue; }
        // Vzdálenost od obrysu: test tlustou čárou (polovina tloušťky = vzdálenost)
        ctx.lineWidth = 2 * tm;
        if (ctx.isPointInStroke(st.path, x * dpr, y * dpr)) {
          ctx.lineWidth = tm;
          const d = ctx.isPointInStroke(st.path, x * dpr, y * dpr) ? T * 0.3 : T * 0.75;
          out.push({ st, d, uvnitr: false, velikost, kruh: false });
        }
      }
    });
    // Nejdřív kroužky, pak to, v čem prst je (menší stát přednost), pak nejbližší
    return out.sort((a, b) => Number(b.kruh && b.uvnitr) - Number(a.kruh && a.uvnitr) || Number(b.uvnitr) - Number(a.uvnitr) || (a.uvnitr && b.uvnitr ? a.velikost - b.velikost : a.d - b.d));
  }
  function tuk(x: number, y: number, typ: string) {
    const mys = typ === 'mouse';
    const T = mys ? 5 : 13; // tolerance kolem prstu (CSS px)
    const MALY = mys ? 14 : 32; // stát menší než tolik px je pro prst „malý“
    const L = kandidati(x, y, T);
    if (!L.length) return;
    const nej = L[0];
    const konkurence = L.slice(1).filter((k) => k.velikost < MALY || k.kruh);
    const naMaximu = s() >= sMax * 0.98;
    if (konkurence.length && !naMaximu) {
      // nejasné: přiblížit kolem prstu, hráč ťukne znovu
      upraveno = true;
      kolemBodu(s() * 2.6, x, y, true);
      o.naPriblizeni?.();
      return;
    }
    const [mx, my] = doMapy(x, y);
    o.naTuk(nej.st.c, mx, my);
  }
  function podMysi(x: number, y: number): string | null {
    const L = kandidati(x, y, 0.5);
    const k = L.find((k) => k.uvnitr);
    return k ? k.st.c : null;
  }

  /* ---------- ovládání ---------- */
  const prsty = new Map<number, { x: number; y: number }>();
  const mereni = merickoRychlosti();
  let tah: { x0: number; y0: number; cx0: number; cy0: number; posun: number; t0: number; typ: string } | null = null;
  let stisk: { d0: number; s0: number; mx: number; my: number } | null = null;
  let gesto = false, zastavil = false;
  const bod = (e: { clientX: number; clientY: number }) => { const r = platno.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const zacniTah = (p: { x: number; y: number }, typ: string, posun = 0) => {
    tah = { x0: p.x, y0: p.y, cx0: cx, cy0: cy, posun, t0: performance.now(), typ };
    mereni.zacni(p.x, p.y);
  };

  function dolu(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Ťuknutí do mapy, která po švihnutí ještě dojíždí, ji jen zastaví. Do animace kamery (přiblížení)
    // se ale ťuknout dá: kamera se zastaví a ťuknutí platí pro to, co je zrovna vidět.
    if (prsty.size === 0) { zastavil = !!dobeh?.bezi(); gesto = false; }
    zastavPohyb();
    const p = bod(e);
    prsty.set(e.pointerId, p);
    try { platno.setPointerCapture(e.pointerId); } catch {}
    if (prsty.size === 1) zacniTah(p, e.pointerType);
    else if (prsty.size === 2) {
      const [a, b] = [...prsty.values()];
      const [mx, my] = doMapy((a.x + b.x) / 2, (a.y + b.y) / 2);
      stisk = { d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), s0: s(), mx, my };
      tah = null; gesto = true;
    }
  }
  function pohyb(e: PointerEvent) {
    const p = bod(e);
    if (!prsty.has(e.pointerId)) {
      if (e.pointerType === 'mouse') {
        const c = podMysi(p.x, p.y);
        if (c !== hover) { hover = c; platno.style.cursor = c ? 'pointer' : ''; kresli(); }
      }
      return;
    }
    prsty.set(e.pointerId, p);
    if (stisk && prsty.size >= 2) {
      const [a, b] = [...prsty.values()];
      const ns = Math.min(sMax, Math.max(sMin, stisk.s0 * (Math.hypot(a.x - b.x, a.y - b.y) / stisk.d0)));
      const sx = (a.x + b.x) / 2, sy = (a.y + b.y) / 2;
      ls = Math.log(ns); cx = stisk.mx - (sx - w / 2) / ns; cy = stisk.my - (sy - h / 2) / ns;
      upraveno = true; omez(); kresli();
      return;
    }
    if (tah) {
      const dx = p.x - tah.x0, dy = p.y - tah.y0;
      tah.posun = Math.max(tah.posun, Math.hypot(dx, dy));
      mereni.pridej(p.x, p.y);
      if (tah.posun > 7) {
        if (hover) { hover = null; }
        cx = tah.cx0 - dx / s(); cy = tah.cy0 - dy / s();
        upraveno = true; omez(); kresli();
        platno.classList.add('se-taha');
      }
    }
  }
  function nahoru(e: PointerEvent) {
    if (!prsty.has(e.pointerId)) return;
    prsty.delete(e.pointerId);
    try { platno.releasePointerCapture(e.pointerId); } catch {}
    if (prsty.size === 1) {
      // z dvou prstů zbyl jeden: plynule pokračovat v posunu
      stisk = null;
      zacniTah([...prsty.values()][0], e.pointerType, 99);
      return;
    }
    if (prsty.size > 0) return;
    platno.classList.remove('se-taha');
    kresli(); // po gestu znovu v plné kvalitě
    const t = tah; tah = null; stisk = null;
    if (!t || e.type === 'pointercancel') return;
    if (t.posun <= 7 && !gesto && !zastavil && performance.now() - t.t0 < 700) { const p = bod(e); tuk(p.x, p.y, t.typ); return; }
    if (t.posun > 7) {
      const [vx, vy] = mereni.rychlost();
      dobeh = setrvacnost([vx, vy], (dx, dy) => { cx -= dx / s(); cy -= dy / s(); const r = omez(); kresli(); return r; }, { hotovo: () => (dobeh = null) });
    }
  }
  function kolecko(e: WheelEvent) {
    if (!(e.ctrlKey || e.metaKey) && !o.kolecko?.()) { o.napovedaKolecka?.(); return; }
    e.preventDefault();
    zastavPohyb();
    const p = bod(e);
    upraveno = true;
    kolemBodu(s() * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0022)), p.x, p.y);
  }
  const opustil = () => { if (hover) { hover = null; platno.style.cursor = ''; kresli(); } };
  platno.addEventListener('pointerdown', dolu);
  platno.addEventListener('pointermove', pohyb);
  platno.addEventListener('pointerup', nahoru);
  platno.addEventListener('pointercancel', nahoru);
  platno.addEventListener('pointerleave', opustil);
  platno.addEventListener('wheel', kolecko, { passive: false });
  platno.addEventListener('contextmenu', (e) => e.preventDefault());
  // starší Safari: sevření prsty nesmí přiblížit celou stránku
  platno.addEventListener('gesturestart', (e) => e.preventDefault());
  // Přepnutí světlého a tmavého vzhledu (stejná událost jako priZmeneTematu, jen jde odhlásit)
  const zmenaTematu = () => { nactiBarvy(); kresli(); };
  document.addEventListener('tema', zmenaTematu);
  const odhlasTema = () => document.removeEventListener('tema', zmenaTematu);

  /* ---------- veřejné ovládání ---------- */
  return {
    /** Které státy hra používá (ostatní jsou šedé a nejde na ně ťuknout) */
    aktivni(kody: Iterable<string>) { const k = new Set(kody); staty.forEach((st) => (st.aktivni = k.has(st.c))); prestav(); },
    stav(c: string, v: StavStatu) { const st = podle.get(c); if (st && st.stav !== v) { st.stav = v; prestav(); } },
    stavy(v: Record<string, StavStatu>) { staty.forEach((st) => (st.stav = v[st.c] ?? 0)); prestav(); },
    hranice(on: boolean) { hranice = on; kresli(); },
    /** Přiblíží na obdélník mapy. okraje = místo zakryté ovládáním (CSS px). */
    naOblast(box: Box, okraje: Okraje = {}, plynule = true) { posledniOblast = { box, okraje }; upraveno = false; naObdelnik(box, okraje, plynule); },
    domu() { if (posledniOblast) { upraveno = false; naObdelnik(posledniOblast.box, posledniOblast.okraje, true); } },
    plus() { upraveno = true; kolemBodu(s() * 1.8, w / 2, h / 2, true); },
    minus() { upraveno = true; kolemBodu(s() / 1.8, w / 2, h / 2, true); },
    /** Uloží a vrátí pohled (kvůli návratu po ukázání správného státu) */
    pohled: () => [ls, cx, cy] as [number, number, number],
    nastavPohled(v: [number, number, number], plynule = true) { jedNa(v[0], v[1], v[2], plynule); },
    /** Ukáže stát: dojede k němu, když není dobře vidět, a nechá ho blikat */
    ukaz(c: string, okraje: Okraje = {}) {
      const st = podle.get(c); if (!st) return;
      const m = s(), [x, y] = naPlatno(st.pt[0], st.pt[1]);
      const rozmer = Math.max(st.box[2] - st.box[0], st.box[3] - st.box[1], 1);
      const videt = x > (okraje.vlevo ?? 0) + 30 && x < w - (okraje.vpravo ?? 0) - 30 && y > (okraje.nahore ?? 0) + 30 && y < h - (okraje.dole ?? 0) - 30;
      if (!videt || (st.path && rozmer * m < 22)) {
        // Přiblížit, aby měl stát aspoň ~30 px, ale ne víc, než je potřeba vidět kus okolí
        // (mikrostáty jsou kroužek, ty stačí ukázat v regionu).
        const okoli = meritkoPro([st.pt[0] - 350, st.pt[1] - 225, st.pt[0] + 350, st.pt[1] + 225], okraje, false);
        const cil = Math.min(sMax, Math.max(m, Math.min(30 / rozmer, okoli)));
        const dx = ((okraje.vlevo ?? 0) - (okraje.vpravo ?? 0)) / 2, dy = ((okraje.nahore ?? 0) - (okraje.dole ?? 0)) / 2;
        upraveno = true;
        jedNa(Math.log(cil), st.pt[0] - dx / cil, st.pt[1] - dy / cil, true);
      }
      efekt(c, 'ukaz');
    },
    /** Krátký efekt na státu; místo = kde se má ukázat kroužek (jinak střed státu) */
    blikni(c: string, typ: 'chyba' | 'ok', mx?: number, my?: number) { efekt(c, typ, mx != null && my != null ? [mx, my] : undefined); },
    smazStitky() { for (const st of stitky.splice(0)) st.el.remove(); },
    stitekStatu(c: string, text: string, typ: 'ok' | 'chyba' | 'info', ms?: number) { const st = podle.get(c); if (st) stitek(text, st.pt[0], st.pt[1], typ, ms); },
    stitekBodu(text: string, mx: number, my: number, typ: 'ok' | 'chyba' | 'info', ms?: number) { stitek(text, mx, my, typ, ms); },
    /** Vzdálenost z bodu mapy k nejbližšímu místu státu: km a směr (sever, severovýchod…) */
    vzdalenost(mx: number, my: number, c: string): { km: number; smer: string } | null {
      const st = podle.get(c); if (!st) return null;
      let bx = st.pt[0], by = st.pt[1], nej = Infinity;
      for (const k of st.kruhy) for (let i = 0; i < k.length; i += 2) { const d = (k[i] - mx) ** 2 + (k[i + 1] - my) ** 2; if (d < nej) { nej = d; bx = k[i]; by = k[i + 1]; } }
      const a = doGeo(mx, my), b = doGeo(bx, by);
      if (!a || !b || !isFinite(a[0]) || !isFinite(b[0])) return null;
      const km = geoDistance(a, b) * 6371;
      const r = Math.PI / 180, f1 = a[1] * r, f2 = b[1] * r, dl = (b[0] - a[0]) * r;
      const azimut = (Math.atan2(Math.sin(dl) * Math.cos(f2), Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl)) / r + 360) % 360;
      const SMERY = ['severně', 'severovýchodně', 'východně', 'jihovýchodně', 'jižně', 'jihozápadně', 'západně', 'severozápadně'];
      return { km, smer: SMERY[Math.round(azimut / 45) % 8] };
    },
    /** Obdélník mapy, který zabírají dané státy (bez obřích přesahů) */
    obdelnik(kody: string[]): Box | null {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const c of kody) { const b = podle.get(c)?.box; if (!b) continue; x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
      return isFinite(x0) ? [x0, y0, x1, y1] : null;
    },
    /** Kde je stát na plátně (CSS px od levého horního rohu mapy) */
    kdeJe(c: string): [number, number] | null { const st = podle.get(c); return st ? naPlatno(st.pt[0], st.pt[1]) : null; },
    meritko: () => s(),
    prekresli() { nactiBarvy(); prestav(); },
    znic() {
      ro.disconnect(); zastavPohyb(); odhlasTema();
      if (animace) cancelAnimationFrame(animace);
      if (naplanovano) cancelAnimationFrame(naplanovano);
      platno.remove(); vrstva.remove();
    },
  };
}
