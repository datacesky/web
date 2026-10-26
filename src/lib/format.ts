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

// Česká typografie v textech novinek: číslo a jednotka (2,5 %, 7,01 Kč) a jednopísmenné předložky (v září, o rok)
// se nerozdělí na konci řádku.
export function nezalomit(text: string): string {
  return text
    .replace(/(\d) (?=%|‰|Kč|p\. b\.|kWh|mil\.|tis\.|mld\.|dolar|eur|dět|host|zem)/g, '$1\u00a0')
    .replace(/(?<=^|[\s(„\u00a0])([vVkKsSzZoOuUaAiI]) /g, '$1\u00a0');
}
