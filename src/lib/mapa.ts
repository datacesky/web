// Sekvenční paleta od světlé po navy. Tmavší = vyšší hodnota.
export const PALETA = ['#DDE2EA', '#AEB9CB', '#7D8DA8', '#4B5E82', '#1B2A4A'];
export const BEZ_DAT = '#E4DDCF';

// Zaokrouhlí na dvě platné číslice, aby legenda byla čitelná (524 951 → 520 000).
export function zaokrouhli(v: number): number {
  if (v === 0) return 0;
  const rad = Math.pow(10, Math.floor(Math.log10(Math.abs(v))) - 1);
  return Math.round(v / rad) * rad;
}

// Hranice tříd podle kvantilů. Vrací až 4 hranice pro 5 tříd.
export function hranice(hodnoty: number[], pocetTrid = PALETA.length): number[] {
  const s = [...hodnoty].sort((a, b) => a - b);
  const out: number[] = [];
  for (let i = 1; i < pocetTrid; i++) {
    const q = (s.length - 1) * (i / pocetTrid);
    const lo = Math.floor(q);
    const hi = Math.ceil(q);
    out.push(zaokrouhli(s[lo] + (s[hi] - s[lo]) * (q - lo)));
  }
  return [...new Set(out)];
}

export function trida(v: number, hr: number[]): number {
  let i = 0;
  while (i < hr.length && v > hr[i]) i++;
  return i;
}

export function barvaTridy(i: number, pocetTrid: number): string {
  if (pocetTrid <= 1) return PALETA[PALETA.length - 1];
  const idx = Math.round((i * (PALETA.length - 1)) / (pocetTrid - 1));
  return PALETA[idx];
}

export type Vrstva = {
  id: string;
  nazev: string;
  popis: string;
  typ: 'ciselna' | 'kategorie';
  jednotka?: string;
  desetinna?: number;
  obdobi: string;
  zdroj: string;
  zdrojUrl: string;
  soucet?: boolean;
  barvy?: Record<string, string>;
  hodnoty: Record<string, number | string>;
};

export function barvaKraje(v: Vrstva, id: string, hr: number[]): string {
  const h = v.hodnoty[id];
  if (h === undefined) return BEZ_DAT;
  if (v.typ === 'kategorie') return v.barvy?.[String(h)] ?? '#6E7C96';
  return barvaTridy(trida(Number(h), hr), hr.length + 1);
}
