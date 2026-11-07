// Otevírací doba z OpenStreetMap (klíč opening_hours) pro mapu supermarketů.
// Rozumí běžným zápisům obchodů: „Mo-Sa 07:00-21:00; Su 08:00-20:00“, „Mo-Fr 07:00-20:00, Sa 07:00-18:00“, „24/7“,
// „Su,PH off“ i dnům kolem Vánoc („Dec 24 07:00-12:00; Dec 25-26 off“). Složitější zápisy (roky, týdny, východ slunce)
// neparsuje a ukáže je tak, jak jsou zapsané, bez údaje, jestli je teď otevřeno.

const DNY_OSM = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const DNY_CZ = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
const DNY_V = ['v pondělí', 'v úterý', 've středu', 've čtvrtek', 'v pátek', 'v sobotu', 'v neděli'];
const MESICE = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

type Usek = [number, number]; // minuty od půlnoci
type Pravidlo = { dny: boolean[] | null; svatek: boolean; data: [number, number, number][] | null; casy: Usek[] }; // casy: [] = zavřeno
export type Doba = { pravidla: Pravidlo[] } | null;

const DEN = '(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)';
const VYBER_DNU = new RegExp(`^(${DEN}(?:-${DEN})?(?:\\s*,\\s*${DEN}(?:-${DEN})?)*)?\\s*(.*)$`);
const MES = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)';
const VYBER_DATA = new RegExp(`^(${MES}\\s*\\d{1,2}(?:\\s*-\\s*\\d{1,2})?(?:\\s*,\\s*(?:${MES}\\s*)?\\d{1,2}(?:\\s*-\\s*\\d{1,2})?)*)\\s+(.*)$`, 'i');

const minuty = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

function nactiCasy(zbytek: string): Usek[] | null {
  const z = zbytek.replace(/"[^"]*"/g, '').trim();
  if (/^(off|closed)$/i.test(z)) return [];
  if (z === '24/7' || z === '00:00-24:00') return [[0, 1440]];
  const casy: Usek[] = [];
  for (const r of z.split(',')) {
    const t = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\+?$/.exec(r.trim());
    if (!t) return null;
    casy.push([minuty(t[1]), minuty(t[2])]);
  }
  return casy;
}

export function nactiDobu(s: string): Doba {
  const text = (s || '').trim();
  if (!text) return null;
  if (text === '24/7') return { pravidla: [{ dny: Array(7).fill(true), svatek: true, data: null, casy: [[0, 1440]] }] };
  const pravidla: Pravidlo[] = [];
  // Pravidla odděluje středník; čárka nebo mezera mezi časem a dalším dnem (Mo-Fr 07:00-20:00, Sa …) taky
  const casti = text
    .replace(new RegExp(`(\\d|off|closed)\\s*,?\\s+(?=${DEN}\\b)|(\\d|off|closed),(?=${DEN}\\b)`, 'g'), '$1$2;')
    .split(';');
  for (const cast of casti) {
    const c = cast.trim();
    if (!c) continue;
    // Konkrétní dny v roce: Dec 24 07:00-12:00, Dec 25-26,Jan 1 off
    const md = VYBER_DATA.exec(c);
    if (md) {
      const data: [number, number, number][] = [];
      let mesic = -1;
      for (const kus of md[1].split(',')) {
        const k = /^\s*([a-z]{3})?\s*(\d{1,2})(?:\s*-\s*(\d{1,2}))?\s*$/i.exec(kus);
        if (!k) return null;
        if (k[1]) mesic = MESICE.indexOf(k[1].toLowerCase());
        if (mesic < 0) return null;
        data.push([mesic + 1, Number(k[2]), Number(k[3] ?? k[2])]);
      }
      const casy = nactiCasy(md[2]);
      if (!casy) return null;
      pravidla.push({ dny: null, svatek: false, data, casy });
      continue;
    }
    const m = VYBER_DNU.exec(c);
    if (!m) return null;
    let dny: boolean[] | null = Array(7).fill(!m[1]);
    let svatek = false;
    if (m[1]) {
      for (const kus of m[1].split(',').map((k) => k.trim())) {
        if (kus === 'PH') { svatek = true; continue; }
        const [od, po] = kus.split('-');
        const a = DNY_OSM.indexOf(od), b = po ? DNY_OSM.indexOf(po) : a;
        if (a < 0 || b < 0) return null;
        for (let i = a; ; i = (i + 1) % 7) { dny[i] = true; if (i === b) break; }
      }
      if (!dny.some(Boolean)) dny = null; // jen PH
    }
    const casy = nactiCasy(m[2]);
    if (!casy) return null;
    pravidla.push({ dny, svatek, data: null, casy });
  }
  return pravidla.length ? { pravidla } : null;
}

// Velikonoční pondělí (gregoriánský výpočet)
function velikonocniPondeli(rok: number) {
  const a = rok % 19, b = Math.floor(rok / 100), c = rok % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mesic = Math.floor((h + l - 7 * m + 114) / 31), den = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(rok, mesic - 1, den + 1);
}

// Dny, kdy mají obchody nad 200 m² ze zákona zavřeno (zákon č. 223/2016 Sb.); 24. 12. od 12:00
export function zavrenoZeZakona(ted: Date): boolean {
  const d = ted.getDate(), m = ted.getMonth() + 1;
  const vp = velikonocniPondeli(ted.getFullYear());
  if (d === vp.getDate() && m === vp.getMonth() + 1) return true;
  if (m === 12 && d === 24) return ted.getHours() >= 12;
  return (m === 1 && d === 1) || (m === 5 && d === 8) || (m === 9 && d === 28) || (m === 10 && d === 28) || (m === 12 && (d === 25 || d === 26));
}
// Svátek, ke kterému se vztahuje „PH“: ty, kdy mají velké obchody celý den zavřeno (Štědrý den se řeší zvlášť)
const jeSvatek = (d: Date) => !(d.getMonth() === 11 && d.getDate() === 24) && zavrenoZeZakona(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 13));

// Časy pro konkrétní den. undefined = svátek bez údaje, pak nic netvrdíme.
function casyDne(d: NonNullable<Doba>, datum: Date): Usek[] | undefined {
  const den = (datum.getDay() + 6) % 7, mesic = datum.getMonth() + 1, dd = datum.getDate();
  const svatek = jeSvatek(datum);
  let tydenni: Usek[] | undefined, zvlastni: Usek[] | undefined;
  for (const p of d.pravidla) {
    if (p.data) { if (p.data.some(([m, a, b]) => m === mesic && dd >= a && dd <= b)) zvlastni = p.casy; continue; }
    if (p.svatek && svatek) zvlastni = p.casy;
    if (p.dny?.[den]) tydenni = p.casy;
  }
  if (zvlastni) return zvlastni;
  if (svatek) return undefined;
  // Štědrý den bez vlastního údaje: běžná doba, ale nejdéle do poledne
  if (mesic === 12 && dd === 24) return (tydenni ?? []).filter(([a]) => a < 720).map(([a, b]) => [a, b < a || b > 720 ? 720 : b] as Usek);
  return tydenni ?? [];
}

const cas = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
const usek = ([a, b]: Usek) => (a === 0 && b === 1440 ? 'nonstop' : `${cas(a)}–${cas(b)}`);
const useky = (c: Usek[]) => (c.length ? c.map(usek).join(', ') : 'zavřeno');

// Řádky pro výpis: dny se stejnou dobou se sloučí (Po–So 7:00–21:00), pak svátky a konkrétní data
export function radkyDoby(d: Doba, puvodni: string): string[] {
  if (!d) {
    if (!puvodni) return [];
    const preklad: Record<string, string> = { Mo: 'Po', Tu: 'Út', We: 'St', Th: 'Čt', Fr: 'Pá', Sa: 'So', Su: 'Ne', PH: 'svátky', off: 'zavřeno', closed: 'zavřeno' };
    return [puvodni.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH|off|closed)\b/g, (x) => preklad[x])];
  }
  const texty = DNY_CZ.map((_, i) => {
    let c: Usek[] = [];
    for (const p of d.pravidla) if (p.dny?.[i]) c = p.casy;
    return useky(c);
  });
  const radky: string[] = [];
  for (let i = 0; i < 7; ) {
    let j = i;
    while (j + 1 < 7 && texty[j + 1] === texty[i]) j++;
    radky.push(`${i === 0 && j === 6 ? 'Po–Ne' : i === j ? DNY_CZ[i] : `${DNY_CZ[i]}–${DNY_CZ[j]}`} ${texty[i]}`);
    i = j + 1;
  }
  for (const p of d.pravidla) {
    if (p.svatek) radky.push(`svátky ${useky(p.casy)}`);
    if (p.data) radky.push(`${p.data.map(([m, a, b]) => (a === b ? `${a}. ${m}.` : `${a}.–${b}. ${m}.`)).join(', ')} ${useky(p.casy)}`);
  }
  return radky;
}

export type Stav = { otevreno: boolean; text: string } | null;

// „Otevřeno · zavírá ve 21:00“ / „Zavřeno · otevírá zítra v 7:00“. Ve svátek bez údaje pro svátky nic netvrdí.
export function stavTed(d: Doba, ted = new Date()): Stav {
  if (!d) return null;
  const den = (ted.getDay() + 6) % 7, min = ted.getHours() * 60 + ted.getMinutes();
  const dnes = casyDne(d, ted);
  if (dnes === undefined) return { otevreno: false, text: 'Dnes je svátek, velké obchody mají zavřeno' };
  // otevřeno od včerejška přes půlnoc
  const vcera = casyDne(d, new Date(ted.getFullYear(), ted.getMonth(), ted.getDate() - 1)) ?? [];
  for (const [a, b] of vcera) if (b < a && min < b) return { otevreno: true, text: `Otevřeno · zavírá v ${cas(b)}` };
  for (const [a, b] of dnes) {
    const konec = b < a ? b + 1440 : b;
    if (min >= a && min < konec) {
      if (a === 0 && konec >= 1440) return { otevreno: true, text: 'Otevřeno nonstop' };
      return { otevreno: true, text: `Otevřeno · zavírá ${konec >= 1440 ? 'o půlnoci' : `v ${cas(konec)}`}` };
    }
  }
  const pozdeji = dnes.filter(([a]) => a > min).sort((x, y) => x[0] - y[0])[0];
  if (pozdeji) return { otevreno: false, text: `Zavřeno · otevírá v ${cas(pozdeji[0])}` };
  for (let k = 1; k <= 7; k++) {
    const c = casyDne(d, new Date(ted.getFullYear(), ted.getMonth(), ted.getDate() + k));
    if (c?.length) return { otevreno: false, text: `Zavřeno · otevírá ${k === 1 ? 'zítra' : DNY_V[(den + k) % 7]} v ${cas(c[0][0])}` };
  }
  return { otevreno: false, text: 'Zavřeno' };
}
