// Denní výzva slepé mapy: každý den 10 států, pro všechny stejných (podle data v pražském čase).
// Hraje se jednou denně, výsledek jde sdílet jako řádek barevných čtverečků.
// Výběr je deterministický: z data se spočítá seminko a z něj „náhodný“ výběr, takže ho nikam nemusíme ukládat.
// Ukládá se jen do prohlížeče (localStorage), stejně jako zbytek her.

export const EPOCHA = '2026-11-18'; // výzva č. 1
const ZONA = 'Europe/Prague';
const K_VYSLEDKY = 'hra_vlajky_vyzvy';
const K_ROZEHRANA = 'hra_vlajky_vyzvaRozehrana';

/** Dnešní datum v Praze jako RRRR-MM-DD (o půlnoci se mění výzva pro všechny naráz) */
export const dnes = () => new Intl.DateTimeFormat('sv-SE', { timeZone: ZONA }).format(new Date());
const denCislo = (d: string) => Math.round(Date.parse(d + 'T12:00:00Z') / 864e5);
const zCisla = (n: number) => new Date(n * 864e5).toISOString().slice(0, 10);
export const cisloVyzvy = (d: string) => denCislo(d) - denCislo(EPOCHA) + 1;
export const hezkeDatum = (d: string) => { const [, m, den] = d.split('-').map(Number); return `${den}. ${m}.`; };

/** Kolik sekund zbývá do půlnoci v Praze */
export function doPulnoci() {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return Math.max(0, 86400 - (g('hour') * 3600 + g('minute') * 60 + g('second')));
}
export const odpocet = (s: number) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/* ---------- výběr států ---------- */
// FNV-1a a na konec promíchání bitů (fmix32), ať se semínka sousedních dní neliší jen v pár bitech
function seminko(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}
function mulberry(a: number) {
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// Pořadí obtížnosti: snadné (velké státy), střední, těžké a jeden opravdu malý na konec
const PASMA: [number, number, number][] = [[0, 60, 3], [60, 120, 4], [120, 160, 2], [160, 999, 1]];
const PORADI = ['s0', 's1', 'm0', 's2', 'm1', 'm2', 't0', 'm3', 't1', 'x0'];
/** Typ otázky na jednotlivých místech: většinou název, dvakrát jen vlajka a jednou hlavní město */
export const TYPY_DNE = ['n', 'n', 'vlajka', 'n', 'cap', 'n', 'vlajka', 'n', 'n', 'n'];

export function vyberDne(d: string, staty: { c: string; ar: number }[]): string[] {
  const r = mulberry(seminko('datacesky-slepa-mapa-' + d));
  for (let i = 0; i < 4; i++) r(); // zahřátí generátoru
  const podleVelikosti = [...staty].sort((a, b) => b.ar - a.ar || a.c.localeCompare(b.c)).map((z) => z.c);
  const skupiny = PASMA.map(([od, po, n]) => {
    const p = podleVelikosti.slice(od, po), out: string[] = [];
    while (out.length < n && p.length) out.push(p.splice(Math.floor(r() * p.length), 1)[0]);
    return out;
  });
  const kod: Record<string, string[]> = { s: skupiny[0], m: skupiny[1], t: skupiny[2], x: skupiny[3] };
  return PORADI.map((k) => kod[k[0]][+k.slice(1)]);
}

/* ---------- výsledky a rozehraná výzva ---------- */
/** v = výsledek u každého státu: 1–3 = našel na tolikátý pokus, 4 = nenašel; b = body (3/2/1/0); t = čas v ms */
export type Vysledek = { v: number[]; b: number; t: number };
export type Rozehrana = { datum: string; pos: number; pokus: number; stav: Record<string, number>; cas: number };
const nacti = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const uloz = (k: string, v: unknown) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch {} };

export const vysledky = () => nacti<Record<string, Vysledek>>(K_VYSLEDKY, {});
export const vysledekDne = (d: string) => vysledky()[d] ?? null;
export function ulozVysledek(d: string, v: Vysledek) { const r = vysledky(); r[d] = v; uloz(K_VYSLEDKY, r); uloz(K_ROZEHRANA, null); }
export const rozehrana = (d: string) => { const r = nacti<Rozehrana | null>(K_ROZEHRANA, null); return r && r.datum === d ? r : null; };
export const ulozRozehranou = (r: Rozehrana) => uloz(K_ROZEHRANA, r);

export const BODY = [0, 3, 2, 1, 0];
export const MAX_BODU = 30;
export const bodyZa = (v: number[]) => v.reduce((s, x) => s + (BODY[x] ?? 0), 0);

export function statistiky() {
  const r = vysledky(), dny = Object.keys(r).sort();
  const hrano = dny.length;
  const body = dny.map((d) => r[d].b);
  // Série: výzvy splněné den po dni, končí dneska (nebo včera, když dnešní ještě čeká)
  let serie = 0, k = denCislo(dnes());
  if (!r[zCisla(k)]) k--;
  while (r[zCisla(k)]) { serie++; k--; }
  let nejdelsi = 0, bezi = 0, pred = -Infinity;
  for (const d of dny) { const n = denCislo(d); bezi = n === pred + 1 ? bezi + 1 : 1; pred = n; nejdelsi = Math.max(nejdelsi, bezi); }
  return { hrano, serie, nejdelsi, nejlepsi: hrano ? Math.max(...body) : 0, prumer: hrano ? Math.round(body.reduce((a, b) => a + b, 0) / hrano) : 0 };
}

/* ---------- sdílení ---------- */
export const minuty = (ms: number) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const CTVERCE = ['', '🟩', '🟨', '🟧', '🟥'];
export function textSdileni(d: string, v: Vysledek) {
  return `Slepá mapa: denní výzva #${cisloVyzvy(d)}\n${v.v.map((x) => CTVERCE[x] ?? '⬜').join('')}\n${v.b}/${MAX_BODU} bodů · ${minuty(v.t)}\nhttps://datacesky.cz/hry/vlajky-sveta/#vyzva`;
}
export function hodnoceni(b: number) {
  return b >= 30 ? 'Perfektní!' : b >= 24 ? 'Výborně!' : b >= 18 ? 'Dobrá práce' : b >= 10 ? 'Ujde to' : 'Zítra to bude lepší';
}
