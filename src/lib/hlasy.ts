// Odesílání hlasů a načítání výsledků hlasování (sdílí stránka Hlasování a pozvánky na ostatních stránkách).

export type Nastaveni = { skript: string; formular: string; pole: string; vysledky: string };
export type Vysledky = { pocty: Map<string, number>; celkem: number };

const KLIC_HLAS = 'dc-hlas';
const KLIC_VOLIC = 'dc-volic';
export const MESIC = 30 * 24 * 3600 * 1000;

// Náhodné anonymní číslo prohlížeče: skript podle něj pozná opakovaný hlas. Nic osobního.
export function volic(): string {
  try {
    let id = localStorage.getItem(KLIC_VOLIC);
    if (!id) {
      id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/[^a-z0-9-]/gi, '');
      localStorage.setItem(KLIC_VOLIC, id);
    }
    return id;
  } catch {
    return '';
  }
}

export function mujHlas(): { a3: string; cas: number } | null {
  try {
    const x = JSON.parse(localStorage.getItem(KLIC_HLAS) ?? 'null');
    return x && Date.now() - x.cas < MESIC ? x : null;
  } catch {
    return null;
  }
}

export function ulozMujHlas(a3: string) {
  try {
    localStorage.setItem(KLIC_HLAS, JSON.stringify({ a3, cas: Date.now() }));
    sessionStorage.setItem('dc-hlas-cerstvy', a3);
  } catch {}
}

const zJson = (j: any): Vysledky => {
  const pocty = new Map<string, number>();
  for (const [k, v] of Object.entries(j?.pocty ?? {})) if (/^[A-Z]{3}$/.test(k) && Number(v) > 0) pocty.set(k, Number(v));
  return { pocty, celkem: [...pocty.values()].reduce((a, b) => a + b, 0) };
};

// jmena: převod ručně psaných názvů ve formuláři („Čína") na kód země
export async function nactiVysledky(N: Nastaveni, jmena?: Map<string, string>): Promise<Vysledky> {
  if (N.skript) {
    const odp = await fetch(`${N.skript}${N.skript.includes('?') ? '&' : '?'}akce=vysledky&t=${Date.now()}`);
    return zJson(await odp.json());
  }
  const odp = await fetch(`${N.vysledky}${N.vysledky.includes('?') ? '&' : '?'}t=${Math.floor(Date.now() / 60000)}`);
  const text = await odp.text();
  if (!odp.ok || text.trimStart().startsWith('<')) throw new Error('Tabulka nevrátila CSV');
  const bez = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const pocty = new Map<string, number>();
  for (const radek of text.split(/\r?\n/).slice(1)) {
    const [hodnota, n] = radek.split(',').map((s) => s.replace(/"/g, '').trim());
    const c = Number(n);
    if (!hodnota || !Number.isFinite(c) || c <= 0) continue;
    const kod = /^[A-Za-z]{3}$/.test(hodnota) ? hodnota.toUpperCase() : jmena?.get(bez(hodnota));
    if (kod) pocty.set(kod, (pocty.get(kod) ?? 0) + c);
  }
  // Vlastní hlas se ve zveřejněné tabulce objeví se zpožděním, proto ho v této relaci přičteme.
  try {
    const m = mujHlas();
    if (m && sessionStorage.getItem('dc-hlas-cerstvy') === m.a3) pocty.set(m.a3, (pocty.get(m.a3) ?? 0) + 1);
  } catch {}
  return { pocty, celkem: [...pocty.values()].reduce((a, b) => a + b, 0) };
}

export type Odpoved = { ok: boolean; chyba?: string; vysledky?: Vysledky };

export async function odesliHlas(N: Nastaveni, a3: string): Promise<Odpoved> {
  if (N.skript) {
    const telo = new URLSearchParams({ kod: a3, volic: volic() });
    try {
      // Jednoduchý požadavek bez vlastních hlaviček, Apps Script odpoví JSONem.
      const odp = await fetch(N.skript, { method: 'POST', body: telo });
      const j = await odp.json();
      return { ok: !!j.ok, chyba: j.chyba, vysledky: j.pocty ? zJson(j) : undefined };
    } catch {
      // Kdyby prohlížeč odpověď nepustil, hlas aspoň odešleme naslepo.
      await fetch(N.skript, { method: 'POST', mode: 'no-cors', body: telo });
      return { ok: true };
    }
  }
  await fetch(N.formular, { method: 'POST', mode: 'no-cors', body: new URLSearchParams({ [N.pole]: a3 }) });
  return { ok: true };
}
