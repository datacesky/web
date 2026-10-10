// 3D model Česka (three.js). Načítá se až ve chvíli, kdy je model na obrazovce, ať nezdržuje zbytek stránky.
// Souřadnice jsou stejné jako u 2D mapy (Mercator, šířka 1000): X = x − 500, Z = y − 289, výška = Y.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

export type Data3D = {
  meta: { roky: number[]; bunka_km: number; zdroje: Record<string, string> };
  obrys: string;
  kraje: { id: string; nazev: string; d: string }[];
  obce: { k: string[]; n: string[]; x: number[]; y: number[]; p: number[][] };
  mrizka: { bunka: number; x: number[]; y: number[]; hustota: number[] };
  zeleznice: number[][][];
  silnice: number[][][];
};
export type VrstvaKraju = { id: string; nazev: string; jednotka?: string; desetinna?: number; obdobi: string; zdroj: string; hodnoty: Record<string, number> };
export type Rezim = 'obce' | 'hustota' | 'zmena' | 'kraje';
export type Info = { titul: string; radky: string[] } | null;

const PALETA = ['#DDE2EA', '#AEB9CB', '#7D8DA8', '#4B5E82', '#1B2A4A'];
const ORANZOVA = new THREE.Color('#F08829');
const RUST = new THREE.Color('#F08829');
const POKLES = new THREE.Color('#6E7C96');
const DESKA = 5;
const CX = 500, CZ = 289;
const fmt = (v: number, d = 0) => new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v).replace('-', '−');

// "M1,2L3,4Z M5,6…" → kruhy bodů
function kruhy(d: string): [number, number][][] {
  return d.split(/(?=M)/).map((c) => [...c.matchAll(/(-?\d+\.?\d*),(-?\d+\.?\d*)/g)].map((m) => [Number(m[1]), Number(m[2])] as [number, number])).filter((r) => r.length > 2);
}
const plocha = (r: [number, number][]) => r.reduce((s, [x, y], i) => { const [x2, y2] = r[(i + 1) % r.length]; return s + x * y2 - x2 * y; }, 0) / 2;
function uvnitr([x, y]: [number, number], r: [number, number][]) {
  let ano = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ano = !ano;
  }
  return ano;
}
// Kruhy na tvary three.js: menší kruh uvnitř většího je díra (Praha ve Středočeském kraji)
function tvary(d: string): THREE.Shape[] {
  const rs = kruhy(d).sort((a, b) => Math.abs(plocha(b)) - Math.abs(plocha(a)));
  const out: { r: [number, number][]; s: THREE.Shape }[] = [];
  const naBod = (r: [number, number][]) => r.map(([x, y]) => new THREE.Vector2(x - CX, CZ - y));
  for (const r of rs) {
    const rodic = out.find((o) => uvnitr(r[0], o.r));
    if (rodic) rodic.s.holes.push(new THREE.Path(naBod(r)));
    else out.push({ r, s: new THREE.Shape(naBod(r)) });
  }
  return out.map((o) => o.s);
}
function cary(linie: number[][][], y: number, barva: string, sirka: number, pruhlednost = 1) {
  const pos: number[] = [];
  for (const l of linie) for (let i = 1; i < l.length; i++) pos.push(l[i - 1][0] - CX, y, l[i - 1][1] - CZ, l[i][0] - CX, y, l[i][1] - CZ);
  const g = new LineSegmentsGeometry();
  g.setPositions(pos);
  const m = new LineMaterial({ color: barva, linewidth: sirka, transparent: pruhlednost < 1, opacity: pruhlednost, depthWrite: pruhlednost === 1 });
  return new LineSegments2(g, m);
}
const kvantily = (h: number[]) => {
  const s = h.filter((x) => x > 0).sort((a, b) => a - b);
  return [0.2, 0.4, 0.6, 0.8].map((q) => s[Math.floor((s.length - 1) * q)]);
};
const trida = (v: number, hr: number[]) => { let i = 0; while (i < hr.length && v > hr[i]) i++; return i; };
const plynule = (t: number) => 1 - Math.pow(1 - t, 3);
const KRATCE: Record<string, string> = {
  praha: 'Praha', stredocesky: 'Středočeský', jihocesky: 'Jihočeský', plzensky: 'Plzeňský', karlovarsky: 'Karlovarský', ustecky: 'Ústecký',
  liberecky: 'Liberecký', kralovehradecky: 'Královéhradecký', pardubicky: 'Pardubický', vysocina: 'Vysočina', jihomoravsky: 'Jihomoravský',
  olomoucky: 'Olomoucký', zlinsky: 'Zlínský', moravskoslezsky: 'Moravskoslezský',
};
const fmtKratce = (v: number, d: number) => (Math.abs(v) >= 1e6 ? `${fmt(v / 1e6, 2)} mil.` : Math.abs(v) >= 1e4 ? `${fmt(v / 1e3, 0)} tis.` : fmt(v, d));

export function spust(scena: HTMLElement, platno: HTMLCanvasElement, data: Data3D, vrstvy: VrstvaKraju[], naInfo: (i: Info, x: number, y: number) => void) {
  const klid = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas: platno, antialias: true, alpha: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const svet = new THREE.Scene();
  const kamera = new THREE.PerspectiveCamera(34, 1, 5, 5000);
  const VYCHOZI = { pozice: new THREE.Vector3(-40, 500, 700), cil: new THREE.Vector3(0, 45, 15) };
  kamera.position.set(0, 1300, 60);
  const ovladani = new OrbitControls(kamera, platno);
  ovladani.target.copy(VYCHOZI.cil);
  ovladani.enableDamping = true;
  ovladani.dampingFactor = 0.08;
  ovladani.minDistance = 180;
  ovladani.maxDistance = 1600;
  ovladani.minPolarAngle = 0.05;
  ovladani.maxPolarAngle = 1.32;
  ovladani.screenSpacePanning = false;
  ovladani.autoRotateSpeed = 0.6;

  svet.add(new THREE.HemisphereLight('#ffffff', '#D9CFBD', 1.6));
  const slunce = new THREE.DirectionalLight('#ffffff', 2.1);
  slunce.position.set(-380, 700, -260);
  svet.add(slunce);

  // Měkký stín pod deskou (gradient na plátně, žádné drahé stíny)
  {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d')!;
    const g = x.createRadialGradient(64, 64, 8, 64, 64, 64);
    g.addColorStop(0, 'rgba(27,42,74,0.32)'); g.addColorStop(1, 'rgba(27,42,74,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const stin = new THREE.Mesh(new THREE.PlaneGeometry(1250, 760), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    stin.rotation.x = -Math.PI / 2; stin.position.set(10, -3, 18);
    svet.add(stin);
  }

  // Deska ve tvaru Česka
  const obrys = tvary(data.obrys);
  const deskaGeo = new THREE.ExtrudeGeometry(obrys, { depth: DESKA, bevelEnabled: false, curveSegments: 1 });
  deskaGeo.rotateX(-Math.PI / 2);
  const deska = new THREE.Mesh(deskaGeo, [new THREE.MeshLambertMaterial({ color: '#FBF8F2' }), new THREE.MeshLambertMaterial({ color: '#E3D9C6' })]);
  svet.add(deska);
  const hraniceKraju = cary(data.kraje.flatMap((k) => kruhy(k.d).map((r) => [...r, r[0]])), DESKA + 0.08, '#CBBFAA', 1.1);
  const obrysCara = cary(kruhy(data.obrys).map((r) => [...r, r[0]]), DESKA + 0.1, '#B9AE9B', 1.6);
  svet.add(hraniceKraju, obrysCara);
  const zeleznice = cary(data.zeleznice, DESKA + 0.15, '#1B2A4A', 1.1, 0.42);
  const silnice = cary(data.silnice, DESKA + 0.2, '#C2611A', 2.2, 0.85);
  zeleznice.visible = false; silnice.visible = false;
  svet.add(zeleznice, silnice);

  // Sloupce obcí
  const N = data.obce.k.length;
  const roky = data.meta.roky;
  const iRok = (r: number) => roky.indexOf(r);
  const kostka = new THREE.BoxGeometry(1, 1, 1); kostka.translate(0, 0.5, 0);
  const sloupce = new THREE.InstancedMesh(kostka, new THREE.MeshLambertMaterial({ color: '#ffffff' }), N);
  sloupce.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const maxPop = Math.max(...data.obce.p.map((p) => p[p.length - 1]));
  const H_OBCE = 210;
  // Mřížka hustoty
  const M = data.mrizka.x.length;
  const bunky = new THREE.InstancedMesh(kostka, new THREE.MeshLambertMaterial({ color: '#ffffff' }), M);
  bunky.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const maxHust = Math.max(...data.mrizka.hustota);
  const H_HUST = 150;
  const hrHust = kvantily(data.mrizka.hustota);
  // Kraje jako hranoly
  const krajeSkupina = new THREE.Group();
  const krajeMesh = data.kraje.map((k) => {
    const g = new THREE.ExtrudeGeometry(tvary(k.d), { depth: 1, bevelEnabled: false, curveSegments: 1 });
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, [new THREE.MeshLambertMaterial({ color: '#7D8DA8' }), new THREE.MeshLambertMaterial({ color: '#4B5E82' })]);
    m.userData.id = k.id; m.userData.nazev = k.nazev;
    m.scale.y = DESKA;
    krajeSkupina.add(m);
    return m;
  });
  // obrys každého kraje nahoře na hranolu, ať jsou sousední kraje rozeznat
  const krajeObrysy = data.kraje.map((k) => {
    const c = cary(kruhy(k.d).map((r) => [...r, r[0]]), 0.06, '#FFFFFF', 1.3, 0.9);
    c.position.y = DESKA;
    krajeSkupina.add(c);
    return c;
  });
  // popisek kraje: bod uvnitř kraje nejdál od jeho hranic (ne v díře), ať se Středočeský nepřekrývá s Prahou
  const stredy = data.kraje.map((k) => {
    const rs = kruhy(k.d).sort((a, b) => Math.abs(plocha(b)) - Math.abs(plocha(a)));
    const [hlavni, ...diry] = rs;
    const xs = hlavni.map((b) => b[0]), ys = hlavni.map((b) => b[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const usecky = rs.flatMap((r) => r.map((b, i) => [b, r[(i + 1) % r.length]] as const));
    const vzd = (x: number, y: number) => Math.min(...usecky.map(([[ax, ay], [bx, by]]) => {
      const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(x - ax - t * dx, y - ay - t * dy);
    }));
    let nej: [number, number] = [(x0 + x1) / 2, (y0 + y1) / 2], max = -1;
    for (let i = 1; i < 24; i++) for (let j = 1; j < 24; j++) {
      const x = x0 + ((x1 - x0) * i) / 24, y = y0 + ((y1 - y0) * j) / 24;
      if (!uvnitr([x, y], hlavni) || diry.some((d) => uvnitr([x, y], d))) continue;
      const v = vzd(x, y);
      if (v > max) { max = v; nej = [x, y]; }
    }
    return nej;
  });
  krajeSkupina.visible = false;
  svet.add(sloupce, bunky, krajeSkupina);

  // výšky a barvy, které se plynule mění
  const obj = new THREE.Object3D();
  const barva = new THREE.Color();
  const hObce = { od: new Float32Array(N), do: new Float32Array(N), ted: new Float32Array(N) };
  const hBunky = { od: new Float32Array(M), do: new Float32Array(M), ted: new Float32Array(M) };
  const hKraje = { od: new Float32Array(krajeMesh.length).fill(DESKA), do: new Float32Array(krajeMesh.length).fill(DESKA), ted: new Float32Array(krajeMesh.length).fill(DESKA) };
  let prechod = { start: 0, doba: 0 };
  let hotovoObce = false, hotovoBunky = false;
  const zapnuto = { zeleznice: false, silnice: false };
  const W_OBCE = 2.2;
  const zapisObce = () => {
    for (let i = 0; i < N; i++) {
      obj.position.set(data.obce.x[i] - CX, DESKA, data.obce.y[i] - CZ);
      obj.scale.set(W_OBCE, Math.max(0.0001, hObce.ted[i]), W_OBCE);
      obj.updateMatrix();
      sloupce.setMatrixAt(i, obj.matrix);
    }
    sloupce.instanceMatrix.needsUpdate = true;
  };
  const b = data.mrizka.bunka;
  const zapisBunky = () => {
    for (let i = 0; i < M; i++) {
      obj.position.set(data.mrizka.x[i] + b / 2 - CX, DESKA, data.mrizka.y[i] + b / 2 - CZ);
      obj.scale.set(b * 0.86, Math.max(0.0001, hBunky.ted[i]), b * 0.86);
      obj.updateMatrix();
      bunky.setMatrixAt(i, obj.matrix);
    }
    bunky.instanceMatrix.needsUpdate = true;
  };
  for (let i = 0; i < M; i++) bunky.setColorAt(i, barva.set(PALETA[trida(data.mrizka.hustota[i], hrHust)]));

  let rezim: Rezim = 'obce';
  let rok = roky[roky.length - 1];
  let vrstva = vrstvy[0];
  let zvyrazneno = -1;

  const barvaObce = (i: number) => {
    if (rezim === 'zmena') {
      const p = data.obce.p[i], z = p[iRok(rok)] - p[0];
      return p[0] === 0 || z === 0 ? barva.set('#D8D0C2') : barva.copy(z > 0 ? RUST : POKLES);
    }
    const v = data.obce.p[i][iRok(rok)];
    return barva.set(PALETA[v < 1000 ? 0 : v < 5000 ? 1 : v < 20000 ? 2 : v < 100000 ? 3 : 4]);
  };
  const obarviObce = () => {
    for (let i = 0; i < N; i++) sloupce.setColorAt(i, i === zvyrazneno ? ORANZOVA : barvaObce(i));
    sloupce.instanceColor!.needsUpdate = true;
  };
  const maxZmena = Math.max(...data.obce.p.map((p) => (p[0] ? Math.abs(p[p.length - 1] - p[0]) : 0)));

  function cile() {
    hObce.od.set(hObce.ted); hBunky.od.set(hBunky.ted); hKraje.od.set(hKraje.ted);
    const ri = iRok(rok);
    for (let i = 0; i < N; i++) {
      const p = data.obce.p[i];
      hObce.do[i] = rezim === 'obce' ? (p[ri] ? Math.max(0.35, (p[ri] / maxPop) * H_OBCE) : 0)
        : rezim === 'zmena' ? (p[0] && p[ri] ? Math.max(0.3, (Math.abs(p[ri] - p[0]) / maxZmena) * 200) : 0) : 0;
    }
    for (let i = 0; i < M; i++) hBunky.do[i] = rezim === 'hustota' ? Math.max(0.3, (data.mrizka.hustota[i] / maxHust) * H_HUST) : 0;
    const hodnoty = Object.values(vrstva?.hodnoty ?? {}).map(Number);
    const max = Math.max(...hodnoty), hr = kvantily(hodnoty);
    krajeMesh.forEach((m, i) => {
      const v = vrstva?.hodnoty[m.userData.id];
      hKraje.do[i] = rezim === 'kraje' && v !== undefined ? DESKA + (v / max) * 90 : DESKA;
      if (v !== undefined) {
        const c = PALETA[trida(v, hr)];
        (m.material as THREE.MeshLambertMaterial[])[0].color.set(c);
        (m.material as THREE.MeshLambertMaterial[])[1].color.set(c).multiplyScalar(0.82);
      }
    });
    obarviObce();
    sloupce.visible = rezim === 'obce' || rezim === 'zmena';
    bunky.visible = rezim === 'hustota';
    krajeSkupina.visible = rezim === 'kraje';
    deska.visible = hraniceKraju.visible = obrysCara.visible = rezim !== 'kraje';
    zeleznice.visible = zapnuto.zeleznice && rezim !== 'kraje';
    silnice.visible = zapnuto.silnice && rezim !== 'kraje';
    prechod = { start: performance.now(), doba: klid ? 0 : 950 };
    pozadej();
  }

  function krokPrechodu(t: number) {
    const k = prechod.doba ? Math.min(1, (t - prechod.start) / prechod.doba) : 1;
    const e = plynule(k);
    for (let i = 0; i < N; i++) hObce.ted[i] = hObce.od[i] + (hObce.do[i] - hObce.od[i]) * e;
    for (let i = 0; i < M; i++) hBunky.ted[i] = hBunky.od[i] + (hBunky.do[i] - hBunky.od[i]) * e;
    krajeMesh.forEach((m, i) => { hKraje.ted[i] = hKraje.od[i] + (hKraje.do[i] - hKraje.od[i]) * e; m.scale.y = hKraje.ted[i]; krajeObrysy[i].position.y = hKraje.ted[i]; });
    if (k < 1 || !hotovoObce) { zapisObce(); hotovoObce = k >= 1; }
    if (k < 1 || !hotovoBunky) { zapisBunky(); hotovoBunky = k >= 1; }
    return k < 1;
  }

  // Popisky největších měst
  const popisky = scena.querySelector<HTMLElement>('[data-c3-popisky]')!;
  const MESTA = 10;
  const stitky = Array.from({ length: MESTA }, (_, i) => {
    const el = document.createElement('span');
    el.className = 'c3__mesto';
    el.textContent = data.obce.n[i].split('|')[0];
    popisky.append(el);
    return el;
  });
  const stitkyKraju = data.kraje.map((k) => {
    const el = document.createElement('span');
    el.className = 'c3__mesto c3__mesto--kraj';
    popisky.append(el);
    return el;
  });
  let ukazPopisky = true;
  const v3 = new THREE.Vector3();
  // Popisky se nepřekrývají: když by se srazily, ukáže se ten důležitější (větší obec nebo vyšší hodnota)
  let obsazeno: number[][] = [];
  let viditelne: { x: number; y: number; el: HTMLElement }[] = [];
  const umisti = (el: HTMLElement, r: DOMRect, ano: boolean) => {
    let videt = ano && v3.z < 1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05;
    if (videt) {
      const x = ((v3.x + 1) / 2) * r.width, y = ((1 - v3.y) / 2) * r.height;
      const w = el.offsetWidth, h = el.offsetHeight;
      const box = [x - w / 2 - 2, y - h - 2, x + w / 2 + 2, y + 2];
      if (obsazeno.some((o) => box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1])) videt = false;
      else { obsazeno.push(box); viditelne.push({ x, y, el }); el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`; }
    }
    el.style.opacity = videt ? '1' : '0';
  };
  function polohaPopisku() {
    const r = platno.getBoundingClientRect();
    obsazeno = []; viditelne = [];
    stitky.forEach((el, i) => {
      const vys = rezim === 'obce' || rezim === 'zmena' ? hObce.ted[i] : 0;
      v3.set(data.obce.x[i] - CX, DESKA + vys + 3, data.obce.y[i] - CZ).project(kamera);
      umisti(el, r, ukazPopisky && rezim !== 'kraje');
    });
    poradiKraju.forEach((i) => {
      v3.set(stredy[i][0] - CX, hKraje.ted[i] + 2, stredy[i][1] - CZ).project(kamera);
      umisti(stitkyKraju[i], r, ukazPopisky && rezim === 'kraje');
    });
  }
  let poradiKraju = data.kraje.map((_, i) => i);
  function textyKraju() {
    poradiKraju = data.kraje.map((_, i) => i).sort((a, b) => (vrstva?.hodnoty[data.kraje[b].id] ?? 0) - (vrstva?.hodnoty[data.kraje[a].id] ?? 0));
    data.kraje.forEach((k, i) => {
      const v = vrstva?.hodnoty[k.id];
      stitkyKraju[i].replaceChildren(document.createTextNode(KRATCE[k.id] ?? k.nazev), Object.assign(document.createElement('b'), { textContent: v === undefined ? '' : fmtKratce(v, vrstva.desetinna ?? 0) }));
    });
  }

  // Vykreslování jen když je potřeba
  let spinavo = true, bezi = false, videt = true;
  let let_: { start: number; z: THREE.Vector3; zc: THREE.Vector3; na: THREE.Vector3; nac: THREE.Vector3; doba: number } | null = null;
  function pozadej() { spinavo = true; if (!bezi && videt) { bezi = true; requestAnimationFrame(smycka); } }
  ovladani.addEventListener('change', pozadej);
  function smycka(t: number) {
    let dal = false;
    if (let_) {
      const k = Math.min(1, (t - let_.start) / let_.doba), e = plynule(k);
      kamera.position.lerpVectors(let_.z, let_.na, e);
      ovladani.target.lerpVectors(let_.zc, let_.nac, e);
      if (k >= 1) let_ = null; else dal = true;
      spinavo = true;
    }
    if (krokPrechodu(t)) { dal = true; spinavo = true; }
    if (ovladani.update()) { dal = true; spinavo = true; }
    if (ovladani.autoRotate) dal = true;
    if (spinavo) { renderer.render(svet, kamera); polohaPopisku(); spinavo = false; }
    if (dal && videt) requestAnimationFrame(smycka); else bezi = false;
  }
  function letNa(na: THREE.Vector3, nac: THREE.Vector3, doba = 1400) {
    let_ = { start: performance.now(), z: kamera.position.clone(), zc: ovladani.target.clone(), na, nac, doba: klid ? 1 : doba };
    pozadej();
  }

  // Velikost plátna podle prvku
  let vychoziPoz: THREE.Vector3 | null = null;
  function velikost() {
    const r = scena.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    kamera.aspect = r.width / r.height;
    // na úzkém displeji se kamera odsune, ať se celé Česko vejde
    kamera.fov = r.width < 600 ? 44 : 34;
    kamera.updateProjectionMatrix();
    // výchozí vzdálenost tak, aby se celé Česko (šířka ~1000) vešlo i na úzký displej
    const pul = Math.atan(Math.tan(THREE.MathUtils.degToRad(kamera.fov / 2)) * kamera.aspect);
    const vzd = Math.max(860, (560 / Math.tan(pul)) * 1.08);
    const smer = VYCHOZI.pozice.clone().sub(VYCHOZI.cil).normalize();
    const nova = VYCHOZI.cil.clone().add(smer.multiplyScalar(vzd));
    if (!let_ && vychoziPoz) kamera.position.add(nova.clone().sub(vychoziPoz));
    vychoziPoz = nova;
    ovladani.maxDistance = Math.max(1600, vzd * 1.6);
    for (const c of [hraniceKraju, obrysCara, zeleznice, silnice]) (c.material as LineMaterial).resolution.set(r.width, r.height);
    pozadej();
  }
  new ResizeObserver(velikost).observe(scena);
  velikost();
  new IntersectionObserver(([z]) => { videt = z.isIntersecting; if (videt) pozadej(); }).observe(scena);

  // Najetí myší / ťuknutí: co je pod kurzorem
  const paprsek = new THREE.Raycaster();
  const dole = new THREE.Vector3(), nahore = new THREE.Vector3();
  const mys = new THREE.Vector2();
  function zjisti(cx: number, cy: number): Info {
    const r = platno.getBoundingClientRect();
    mys.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    paprsek.setFromCamera(mys, kamera);
    const ri = iRok(rok);
    if (rezim === 'obce' || rezim === 'zmena') {
      const h = paprsek.intersectObject(sloupce)[0];
      let i = h?.instanceId ?? -1;
      // sloupce jsou tenké: když kurzor netrefí přesně, vezme se nejbližší sloupec do 12 px
      if (i < 0) {
        const px = cx - r.left, py = cy - r.top;
        let nej = 144;
        for (let j = 0; j < N; j++) {
          const vyska = hObce.ted[j];
          if (vyska < 0.5) continue;
          dole.set(data.obce.x[j] - CX, DESKA, data.obce.y[j] - CZ).project(kamera);
          nahore.set(data.obce.x[j] - CX, DESKA + vyska, data.obce.y[j] - CZ).project(kamera);
          const ax = ((dole.x + 1) / 2) * r.width, ay = ((1 - dole.y) / 2) * r.height;
          const bx = ((nahore.x + 1) / 2) * r.width, by = ((1 - nahore.y) / 2) * r.height;
          const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
          const d2 = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
          if (d2 < nej) { nej = d2; i = j; }
        }
      }
      if (i !== zvyrazneno) { zvyrazneno = i; obarviObce(); pozadej(); }
      if (i < 0) return null;
      const [jm, okres] = data.obce.n[i].split('|');
      const p = data.obce.p[i];
      const radky = [`${fmt(p[ri])} obyvatel (${rok})`];
      if (p[0] && rok !== roky[0]) {
        const z = p[ri] - p[0];
        radky.push(`${z > 0 ? '+' : ''}${fmt(z)} od roku ${roky[0]} (${z > 0 ? '+' : ''}${fmt((z / p[0]) * 100, 1)} %)`);
      }
      return { titul: okres && okres !== jm ? `${jm} · okres ${okres}` : jm, radky };
    }
    if (zvyrazneno >= 0) { zvyrazneno = -1; obarviObce(); pozadej(); }
    if (rezim === 'hustota') {
      const h = paprsek.intersectObject(bunky)[0];
      if (h?.instanceId === undefined) return null;
      return { titul: `Čtverec ${fmt(data.meta.bunka_km, 0)} × ${fmt(data.meta.bunka_km, 0)} km`, radky: [`${fmt(data.mrizka.hustota[h.instanceId])} obyvatel na km² (${roky[roky.length - 1]})`] };
    }
    const h = paprsek.intersectObjects(krajeMesh)[0];
    if (!h) return null;
    const m = h.object as THREE.Mesh;
    const v = vrstva.hodnoty[m.userData.id];
    return { titul: m.userData.nazev, radky: [`${vrstva.nazev}: ${fmt(v, vrstva.desetinna ?? 0)}${vrstva.jednotka ? ' ' + vrstva.jednotka : ''}`, vrstva.obdobi] };
  }
  let cekajici: PointerEvent | null = null;
  platno.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || e.buttons) return;
    if (!cekajici) requestAnimationFrame(() => { const p = cekajici!; cekajici = null; naInfo(zjisti(p.clientX, p.clientY), p.clientX, p.clientY); });
    cekajici = e;
  });
  platno.addEventListener('pointerleave', () => { naInfo(null, 0, 0); if (zvyrazneno >= 0) { zvyrazneno = -1; obarviObce(); pozadej(); } });
  let dolu = { x: 0, y: 0, t: 0 };
  platno.addEventListener('pointerdown', (e) => { dolu = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  platno.addEventListener('pointerup', (e) => {
    // ťuknutí (ne tažení) ukáže detail i na dotykovém displeji
    if (Math.hypot(e.clientX - dolu.x, e.clientY - dolu.y) < 6 && performance.now() - dolu.t < 400) naInfo(zjisti(e.clientX, e.clientY), e.clientX, e.clientY);
  });

  textyKraju();
  cile();
  letNa(vychoziPoz!.clone(), VYCHOZI.cil.clone(), 2200);
  setTimeout(() => { if (!klid) { ovladani.autoRotate = true; pozadej(); } }, 2300);
  // Jakmile člověk sáhne na model, otáčení se zastaví
  platno.addEventListener('pointerdown', () => { ovladani.autoRotate = false; }, { capture: true });
  platno.addEventListener('wheel', () => { ovladani.autoRotate = false; }, { passive: true, capture: true });

  return {
    nastavRezim(r: Rezim) { rezim = r; zvyrazneno = -1; cile(); },
    nastavRok(r: number) { if (r !== rok) { rok = r; cile(); } },
    nastavVrstvu(id: string) { vrstva = vrstvy.find((v) => v.id === id) ?? vrstvy[0]; textyKraju(); cile(); },
    vrstva: () => vrstva,
    prepni(co: 'zeleznice' | 'silnice' | 'popisky' | 'otacet', ano: boolean) {
      if (co === 'zeleznice') { zapnuto.zeleznice = ano; zeleznice.visible = ano && rezim !== 'kraje'; }
      if (co === 'silnice') { zapnuto.silnice = ano; silnice.visible = ano && rezim !== 'kraje'; }
      if (co === 'popisky') { ukazPopisky = ano; polohaPopisku(); }
      if (co === 'otacet') ovladani.autoRotate = ano;
      pozadej();
    },
    otaci: () => ovladani.autoRotate,
    priblizit(k: number) {
      const smer = kamera.position.clone().sub(ovladani.target);
      const d = THREE.MathUtils.clamp(smer.length() * k, ovladani.minDistance, ovladani.maxDistance);
      letNa(ovladani.target.clone().add(smer.setLength(d)), ovladani.target.clone(), 450);
    },
    vychozi() { letNa(vychoziPoz!.clone(), VYCHOZI.cil.clone(), 1100); },
    ovladani,
    // Obrázek k uložení: aktuální pohled na krémovém podkladu, s nadpisem, zdrojem a vodoznakem
    obrazek(nadpis: string, zdroj: string): string {
      renderer.render(svet, kamera);
      const src = renderer.domElement;
      const W = src.width, H = src.height, s = W / 1200;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d')!;
      x.fillStyle = '#F2EDE3'; x.fillRect(0, 0, W, H);
      x.drawImage(src, 0, 0);
      x.fillStyle = '#1B2A4A'; x.font = `900 ${Math.round(40 * s)}px Montserrat, sans-serif`; x.textBaseline = 'top';
      x.fillText(nadpis.toUpperCase(), 36 * s, 30 * s);
      // popisky měst a krajů tak, jak jsou právě vidět
      const k = W / platno.getBoundingClientRect().width;
      for (const p of viditelne) {
        const radky = Array.from(p.el.childNodes).map((n) => n.textContent ?? '').filter(Boolean);
        if (!radky.length) radky.push(p.el.textContent ?? '');
        x.font = `800 ${Math.round(12 * k)}px Montserrat, sans-serif`;
        const sirka = Math.max(...radky.map((t) => x.measureText(t).width)) + 14 * k, vyska = radky.length * 15 * k + 6 * k;
        const px = p.x * k - sirka / 2, py = p.y * k - vyska;
        x.fillStyle = 'rgba(255,255,255,0.92)'; x.beginPath(); x.roundRect(px, py, sirka, vyska, 9 * k); x.fill();
        x.textBaseline = 'top'; x.textAlign = 'center';
        radky.forEach((t, i) => { x.fillStyle = i ? '#9A520E' : '#1B2A4A'; x.fillText(t, p.x * k, py + 4 * k + i * 15 * k); });
        x.textAlign = 'left';
      }
      // zdroj zalomený tak, aby nezasahoval do vodoznaku
      x.fillStyle = '#56627A'; x.font = `600 ${Math.round(16 * s)}px Montserrat, sans-serif`; x.textBaseline = 'alphabetic';
      const max = W - 36 * s - 230 * s, slova = zdroj.split(' '), radky: string[] = [];
      for (const w of slova) { const t = radky.length ? `${radky[radky.length - 1]} ${w}` : w; if (radky.length && x.measureText(t).width <= max) radky[radky.length - 1] = t; else radky.push(w); }
      radky.forEach((t, i) => x.fillText(t, 36 * s, H - 30 * s - (radky.length - 1 - i) * 22 * s));
      const tw = 170 * s, th = 42 * s, tx = W - tw - 30 * s, ty = H - th - 22 * s;
      x.fillStyle = '#1B2A4A'; x.beginPath(); x.roundRect(tx, ty, tw, th, th / 2); x.fill();
      x.font = `800 ${Math.round(18 * s)}px Montserrat, sans-serif`; x.textBaseline = 'middle';
      x.fillStyle = '#F2EDE3'; const t1 = '@data'; const w1 = x.measureText(t1).width; const w2 = x.measureText('.cesky').width;
      const sx = tx + (tw - w1 - w2) / 2; x.fillText(t1, sx, ty + th / 2);
      x.fillStyle = '#F08829'; x.fillText('.cesky', sx + w1, ty + th / 2);
      return c.toDataURL('image/png');
    },
  };
}
