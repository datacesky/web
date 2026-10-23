// Barvy jako CSS proměnné, aby se grafy samy přebarvily ve tmavém režimu (hodnoty jsou v global.css)
export const BRAND: Record<string, string> = {
  cream: 'var(--cream)',
  navy: 'var(--navy)',
  orange: 'var(--orange)',
  teal: 'var(--teal)',
  slate: 'var(--slate)',
  hneda: 'var(--hneda)',
};

const VYCHOZI_KATEGORIE: Record<string, string> = {
  'Zbrojařství': 'orange',
  'Finance': 'navy',
  'Energetika': 'teal',
  'Ostatní': 'slate',
  'Česko': 'orange',
  'Odhad': 'teal',
};

export function barvaKategorie(kategorie?: string, vlastni: Record<string, string> = {}): string {
  const klic = (kategorie && (vlastni[kategorie] ?? VYCHOZI_KATEGORIE[kategorie])) || 'navy';
  return BRAND[klic] ?? klic;
}

// desetinna = pevný počet desetinných míst (36 → 36,0). Bez něj se ukáže nejvýš jedno.
export function cislo(hodnota: number, desetinna?: number): string {
  const moznosti = desetinna === undefined
    ? { maximumFractionDigits: 1 }
    : { minimumFractionDigits: desetinna, maximumFractionDigits: desetinna };
  return new Intl.NumberFormat('cs-CZ', moznosti).format(hodnota);
}

export function datum(d: Date): string {
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

export function sklonuj(n: number, jeden: string, dva: string, pet: string): string {
  if (n === 1) return `${n} ${jeden}`;
  if (n >= 2 && n <= 4) return `${n} ${dva}`;
  return `${n} ${pet}`;
}
