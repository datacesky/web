// Dlouhodobé skóre všech her na webu (/hry/).
// Ukládá se jen do prohlížeče na tomhle zařízení (localStorage, klíč „hry_profil“), na žádný server.
// Každá hra po dokončení zapíše „záznam“ (zapis). Záznam jde i vrátit (vrat), proto funguje krok zpět
// i po konci hry. Nová hra jen zavolá zapis() se svým id (např. 'vlajky') a svými čísly.

export type HracSiny = { jmeno: string; hry: number; vyhry: number; body: number; spravne: number; tahu: number; posledni: string };
export type Profil = {
  v: 1;
  skore: number; // celkové body ze všech her
  her: number; // dokončené hry
  spravne: number;
  odpovedi: number;
  den: { posledni: string; serie: number; nejdelsi: number };
  hry: Record<string, Record<string, number>>; // čísla jednotlivých her, např. vlajky.bleskovky
  objev: Record<string, string[]>; // co hráč v dané hře „objevil“ (u Vlajek kódy států)
  sin: Record<string, HracSiny>; // síň slávy, klíč = jméno malými písmeny
};
export type Zaznam = {
  hra: string;
  skore?: number;
  her?: number;
  spravne?: number;
  odpovedi?: number;
  cisla?: Record<string, number>; // přičte se do profil.hry[hra]
  rekordy?: Record<string, number>; // zapíše se jen, když je vyšší (vrácení obnoví předchozí)
  objev?: string[];
  hraci?: { jmeno: string; body: number; vyhra: boolean; spravne: number; tahu: number }[];
  // vyplní zapis(): co bylo opravdu nové, ať jde záznam přesně vrátit
  _nove?: string[];
  _predRekordy?: Record<string, number | undefined>;
  _noviHraci?: string[];
};

const KLIC = 'hry_profil';
const prazdny = (): Profil => ({ v: 1, skore: 0, her: 0, spravne: 0, odpovedi: 0, den: { posledni: '', serie: 0, nejdelsi: 0 }, hry: {}, objev: {}, sin: {} });

export function nactiProfil(): Profil {
  let p = prazdny();
  try {
    const s = localStorage.getItem(KLIC);
    if (s) p = { ...p, ...JSON.parse(s) };
  } catch {}
  // Rekord z bleskovky z doby před profilem (hra_vlajky_rekord) se převezme
  try {
    const stary = Number(JSON.parse(localStorage.getItem('hra_vlajky_rekord') || '0')) || 0;
    if (stary && !(p.hry.vlajky?.rekord >= stary)) { (p.hry.vlajky ??= {}).rekord = stary; ulozProfil(p); }
  } catch {}
  return p;
}
export function ulozProfil(p: Profil) {
  try { localStorage.setItem(KLIC, JSON.stringify(p)); } catch {}
}
export function smazProfil() {
  try { localStorage.removeItem(KLIC); localStorage.removeItem('hra_vlajky_rekord'); } catch {}
}

const dnes = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const vcera = () => { const d = new Date(); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const klicJmena = (j: string) => j.trim().toLowerCase().replace(/\s+/g, ' ');
// Výchozí jména („Hráč 1“) se do síně slávy nepočítají
export const vychoziJmeno = (j: string) => /^hráč\s*\d+$/i.test(j.trim()) || !j.trim();

/** Zapíše výsledek hry do profilu. Vrací záznam doplněný o to, co bylo nové (pro vrat). */
export function zapis(z: Zaznam): Zaznam {
  const p = nactiProfil();
  p.skore += z.skore ?? 0;
  p.her += z.her ?? 0;
  p.spravne += z.spravne ?? 0;
  p.odpovedi += z.odpovedi ?? 0;
  const h = (p.hry[z.hra] ??= {});
  for (const [k, v] of Object.entries(z.cisla ?? {})) h[k] = (h[k] ?? 0) + v;
  z._predRekordy = {};
  for (const [k, v] of Object.entries(z.rekordy ?? {})) { z._predRekordy[k] = h[k]; if (!(h[k] >= v)) h[k] = v; }
  const o = new Set(p.objev[z.hra] ?? []);
  z._nove = (z.objev ?? []).filter((c) => !o.has(c));
  z._nove.forEach((c) => o.add(c));
  p.objev[z.hra] = [...o];
  z._noviHraci = [];
  for (const q of z.hraci ?? []) {
    if (vychoziJmeno(q.jmeno)) continue;
    const k = klicJmena(q.jmeno);
    if (!p.sin[k]) { p.sin[k] = { jmeno: q.jmeno.trim(), hry: 0, vyhry: 0, body: 0, spravne: 0, tahu: 0, posledni: '' }; z._noviHraci.push(k); }
    const s = p.sin[k];
    s.jmeno = q.jmeno.trim(); s.hry++; s.vyhry += q.vyhra ? 1 : 0; s.body += q.body; s.spravne += q.spravne; s.tahu += q.tahu; s.posledni = dnes();
  }
  // Série dní: hraješ každý den
  const d = dnes();
  if (p.den.posledni !== d) {
    p.den.serie = p.den.posledni === vcera() ? p.den.serie + 1 : 1;
    p.den.posledni = d;
    p.den.nejdelsi = Math.max(p.den.nejdelsi, p.den.serie);
  }
  ulozProfil(p);
  return z;
}

/** Vrátí dříve zapsaný záznam (krok zpět). Sérii dní nechává, jak je. */
export function vrat(z: Zaznam) {
  const p = nactiProfil();
  p.skore = Math.max(0, p.skore - (z.skore ?? 0));
  p.her = Math.max(0, p.her - (z.her ?? 0));
  p.spravne = Math.max(0, p.spravne - (z.spravne ?? 0));
  p.odpovedi = Math.max(0, p.odpovedi - (z.odpovedi ?? 0));
  const h = (p.hry[z.hra] ??= {});
  for (const [k, v] of Object.entries(z.cisla ?? {})) h[k] = Math.max(0, (h[k] ?? 0) - v);
  for (const [k, v] of Object.entries(z._predRekordy ?? {})) { if (v == null) delete h[k]; else h[k] = v; }
  if (z._nove?.length) { const pryc = new Set(z._nove); p.objev[z.hra] = (p.objev[z.hra] ?? []).filter((c) => !pryc.has(c)); }
  for (const q of z.hraci ?? []) {
    if (vychoziJmeno(q.jmeno)) continue;
    const k = klicJmena(q.jmeno), s = p.sin[k];
    if (!s) continue;
    if (z._noviHraci?.includes(k)) { delete p.sin[k]; continue; }
    s.hry = Math.max(0, s.hry - 1); s.vyhry = Math.max(0, s.vyhry - (q.vyhra ? 1 : 0)); s.body = Math.max(0, s.body - q.body);
    s.spravne = Math.max(0, s.spravne - q.spravne); s.tahu = Math.max(0, s.tahu - q.tahu);
  }
  ulozProfil(p);
}

// Úrovně: první dostaneš rychle, další jsou čím dál dál od sebe
const PRAHY = [0, 20, 50, 100, 175, 275, 400, 575, 800, 1100, 1500, 2000];
const TITULY = ['Turista', 'Výletník', 'Cestovatel', 'Objevitel', 'Průzkumník', 'Kartograf', 'Geograf', 'Diplomat', 'Velvyslanec', 'Světoběžník', 'Mistr atlasu', 'Legenda'];
export function uroven(skore: number) {
  let i = 0;
  while (i + 1 < PRAHY.length && skore >= PRAHY[i + 1]) i++;
  let od = PRAHY[i], doo = PRAHY[i + 1], cislo = i + 1, nazev = TITULY[i];
  if (i === PRAHY.length - 1) {
    // Za poslední úrovní každých 600 bodů další stupeň „Legendy“
    const navic = Math.floor((skore - od) / 600);
    od += navic * 600; doo = od + 600; cislo += navic; if (navic) nazev = `${TITULY[i]} ${navic + 1}`;
  }
  return { cislo, nazev, od, do: doo, chybi: doo - skore, podil: Math.min(1, (skore - od) / (doo - od)) };
}

export const sklonuj = (n: number, jeden: string, dva: string, pet: string) => (n === 1 ? jeden : n >= 2 && n <= 4 ? dva : pet);
export const cislo = (n: number) => new Intl.NumberFormat('cs-CZ').format(n).replace(/ /g, ' ');

/** Síň slávy seřazená podle výher, pak bodů */
export const sinSlavy = (p: Profil) => Object.values(p.sin).sort((a, b) => b.vyhry - a.vyhry || b.body - a.body || b.hry - a.hry);

// Celá obrazovka: překryv přes hlavičku a spodní lištu webu + Fullscreen API, kde ho prohlížeč umí
// (počítač, Android). iPhone ho pro stránky nemá, tam zůstane jen překryv, který stačí, aby se hra vešla.
export function umiFullscreen() {
  const d = document.documentElement as any;
  return !!(d.requestFullscreen || d.webkitRequestFullscreen);
}
export async function zapniFullscreen() {
  const d = document.documentElement as any;
  try {
    if (document.fullscreenElement || (document as any).webkitFullscreenElement) return;
    if (d.requestFullscreen) await d.requestFullscreen({ navigationUI: 'hide' });
    else if (d.webkitRequestFullscreen) d.webkitRequestFullscreen();
  } catch {}
}
export async function vypniFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if ((document as any).webkitFullscreenElement) (document as any).webkitExitFullscreen?.();
  } catch {}
}
export const jeFullscreen = () => !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
