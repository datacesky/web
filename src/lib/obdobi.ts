// Čitelné názvy období z kódů dat: 2026-08, 2026-Q2, 2026-W41, 2026
const MESICE = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
const MESICE_K = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];

export function obdobi(kod: string, kratce = false): string {
  let m = kod.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${(kratce ? MESICE_K : MESICE)[Number(m[2]) - 1]} ${m[1]}`;
  m = kod.match(/^(\d{4})-Q(\d)$/);
  if (m) return kratce ? `Q${m[2]} ${m[1]}` : `${m[2]}. čtvrtletí ${m[1]}`;
  m = kod.match(/^(\d{4})-W(\d{2})$/);
  if (m) return `${Number(m[2])}. týden ${m[1]}`;
  return kod;
}

const nf = (d: number) => new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: d, maximumFractionDigits: d });

// Číslo s pevným počtem desetinných míst, záporné s pravým minusem
export function hodnota(v: number, d = 1, znamenko = false): string {
  const s = nf(d).format(v).replace('-', '−');
  return znamenko && v > 0 ? `+${s}` : s;
}

// Krátký tvar pro popisky v malém grafu: 3 006 002 → 3,0 mil.
export function kratce(v: number, d = 1, znamenko = false): string {
  const a = Math.abs(v);
  if (a >= 1e6) return `${hodnota(v / 1e6, 1, znamenko)} mil.`;
  if (a >= 1e4) return `${hodnota(v / 1e3, 0, znamenko)} tis.`;
  return hodnota(v, d, znamenko);
}
