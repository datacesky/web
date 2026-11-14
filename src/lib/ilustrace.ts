// Ilustrace na náhledy novinek: velká přátelská ikonka ve stylu data.cesky (krémová, námořnická, oranžová).
// Kreslí se jako SVG přímo do stránky, barvy berou z CSS proměnných webu, takže fungují i v tmavém režimu.
// Plátno 200 × 160, zem (stín) kolem y = 143. Třídy barev jsou v src/components/NahledNovinky.astro:
//   n námořnická · o oranžová · os světle oranžová · m hořčicová · p papír (bílá) · b béžová · t tyrkysová
//   s modrošedá · sh stín · k obrys (námořnický tah) · l jen čára
// Klíč je id ikony novinky (pole ikona: v src/content/novinky/*.md, seznam ikon v src/lib/ikony.ts).

const jiskra = (x: number, y: number, r: number, c = 'm') =>
  `<path class="${c}" d="M${x} ${y - r}Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y}Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r}Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y}Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}z"/>`;
const stin = (cx = 100, rx = 58) => `<ellipse class="sh" cx="${cx}" cy="143" rx="${rx}" ry="7"/>`;
const mince = (cx: number, cy: number, r = 11) =>
  `<circle class="m k" cx="${cx}" cy="${cy}" r="${r}"/><circle class="os" cx="${cx}" cy="${cy}" r="${r * 0.5}"/>`;
// sloupek mincí zboku: n mincí od země nahoru
const sloupekMinci = (cx: number, n: number, sirka = 34) =>
  Array.from({ length: n }, (_, i) => {
    const y = 132 - i * 9;
    return `<rect class="m k" x="${cx - sirka / 2}" y="${y}" width="${sirka}" height="10" rx="5"/>`;
  }).join('');

export const ILUSTRACE: Record<string, string> = {
  // Pohonné hmoty: stojan s hadicí a kapkou
  pumpa: `${stin(96, 56)}
    <path class="l" d="M120 104h12a9 9 0 0 0 9-9V62l-9-12"/>
    <path class="o k" d="M124 36l15-6 9 15-15 6z"/>
    <rect class="p" x="56" y="26" width="64" height="112" rx="13"/>
    <rect class="o" x="56" y="84" width="64" height="15"/>
    <rect class="l" x="56" y="26" width="64" height="112" rx="13"/>
    <rect class="n" x="65" y="36" width="46" height="32" rx="7"/>
    <rect class="o" x="72" y="44" width="24" height="6" rx="3"/>
    <rect class="os" x="72" y="55" width="32" height="5" rx="2.5"/>
    <path class="n" d="M88 106c-6 7-9 12-9 16a9 9 0 0 0 18 0c0-4-3-9-9-16z"/>
    <rect class="n" x="46" y="132" width="84" height="11" rx="5.5"/>
    <path class="o k" d="M152 62c-4 5-6 8-6 11a6 6 0 0 0 12 0c0-3-2-6-6-11z"/>
    ${jiskra(40, 48, 9)}${jiskra(164, 104, 6, 'os')}`,

  // Inflace: cenovka s procentem a mince
  cenovka: `${stin(100, 62)}
    <g transform="rotate(-14 100 82)">
      <path class="o k" d="M62 46h58l30 34-30 34H62a10 10 0 0 1-10-10V56a10 10 0 0 1 10-10z"/>
      <circle class="p k" cx="128" cy="80" r="7"/>
      <path class="p" d="M74 66a7 7 0 1 1 0 .1zM100 92a7 7 0 1 1 0 .1z"/>
      <path class="l l--p" d="M100 62L72 100"/>
      <path class="l l--tenka" d="M128 80c12-4 22-16 20-30"/>
    </g>
    ${mince(52, 124, 13)}${mince(76, 132, 9)}
    ${jiskra(160, 112, 8)}${jiskra(36, 46, 6, 'os')}`,

  // Nezaměstnanost: kufřík a lupa (hledání práce)
  kufrik: `${stin(98, 62)}
    <path class="l" d="M80 50V42a8 8 0 0 1 8-8h22a8 8 0 0 1 8 8v8"/>
    <rect class="n" x="46" y="50" width="106" height="84" rx="14"/>
    <path class="s" d="M46 82h106v10H46z"/>
    <rect class="o k" x="88" y="76" width="22" height="22" rx="5"/>
    <circle class="p k" cx="146" cy="58" r="22"/>
    <circle class="os" cx="146" cy="58" r="12"/>
    <path class="l" d="M162 74l16 16"/>
    <path class="l l--silna" d="M168 80l10 10"/>
    ${jiskra(34, 44, 8)}${jiskra(30, 112, 5, 'os')}`,

  // Turisté: kufr na kolečkách s nálepkami a letadlo
  kufr: `${stin(92, 48)}
    <path class="l" d="M80 34V22h24v12"/>
    <rect class="o k" x="62" y="34" width="60" height="96" rx="12"/>
    <path class="l l--tenka" d="M78 46v72M106 46v72"/>
    <circle class="p k" cx="92" cy="66" r="11"/>
    ${jiskra(92, 66, 6, 'o')}
    <rect class="t k" x="80" y="94" width="24" height="16" rx="4" transform="rotate(-8 92 102)"/>
    <circle class="n" cx="74" cy="136" r="6"/><circle class="n" cx="110" cy="136" r="6"/>
    <path class="l l--carkovana" d="M28 84c20-26 60-40 104-46"/>
    <g transform="translate(150 34) rotate(-18)">
      <path class="n" d="M-18 2c0-3 3-5 6-5h26c5 0 9 2 9 5s-4 5-9 5h-26c-3 0-6-2-6-5z"/>
      <path class="n" d="M-2-2l-8-16h7l14 16zM-2 6l-8 14h7l14-14zM-14 0l-6-10h5l7 8z"/>
      <circle class="o" cx="16" cy="2" r="2.2"/>
    </g>
    ${jiskra(160, 98, 8)}${jiskra(36, 120, 5, 'os')}`,

  // Ekonomika (HDP): sloupce a šipka nahoru
  trend: `${stin(100, 64)}
    <rect class="b k" x="46" y="98" width="22" height="38" rx="5"/>
    <rect class="os k" x="76" y="82" width="22" height="54" rx="5"/>
    <rect class="m k" x="106" y="64" width="22" height="72" rx="5"/>
    <rect class="o k" x="136" y="42" width="22" height="94" rx="5"/>
    <path class="l l--silna" d="M40 82l30-20 24 10 46-40"/>
    <path class="n" d="M128 22l26-2-4 26z"/>
    ${jiskra(34, 40, 8)}${jiskra(176, 92, 6, 'os')}`,

  // Průmysl: továrna s komíny a ozubeným kolem
  tovarna: `${stin(100, 66)}
    <circle class="b" cx="66" cy="22" r="9"/><circle class="b" cx="78" cy="14" r="7"/><circle class="b" cx="132" cy="30" r="8"/><circle class="b" cx="142" cy="22" r="6"/>
    <rect class="p k" x="58" y="34" width="16" height="50" rx="3"/>
    <rect class="o" x="58" y="44" width="16" height="7"/>
    <rect class="p k" x="124" y="44" width="16" height="40" rx="3"/>
    <rect class="o" x="124" y="54" width="16" height="7"/>
    <path class="p k" d="M40 136V86l28-16v16l28-16v16l28-16v16l28-16v66z"/>
    <rect class="m" x="52" y="100" width="14" height="12" rx="2"/><rect class="m" x="76" y="100" width="14" height="12" rx="2"/>
    <rect class="m" x="100" y="100" width="14" height="12" rx="2"/><rect class="m" x="124" y="100" width="14" height="12" rx="2"/>
    <rect class="n" x="40" y="120" width="112" height="16" rx="3"/>
    <g transform="translate(158 116)">
      <path class="o k" d="M-4-20h8l2 6 6 3 6-3 6 6-3 6 3 6 6 2v8l-6 2-3 6 3 6-6 6-6-3-6 3-2 6h-8l-2-6-6-3-6 3-6-6 3-6-3-6-6-2v-8l6-2 3-6-3-6 6-6 6 3 6-3z" transform="scale(.8)"/>
      <circle class="p k" cx="0" cy="0" r="6"/>
    </g>
    ${jiskra(30, 54, 7)}`,

  // Maloobchod: nákupní vozík s nákupem
  kosik: `${stin(98, 60)}
    <rect class="m k" x="74" y="34" width="14" height="44" rx="7" transform="rotate(-18 81 56)"/>
    <rect class="t k" x="98" y="30" width="16" height="44" rx="5"/>
    <rect class="p" x="102" y="38" width="8" height="12" rx="2"/>
    <circle class="o k" cx="132" cy="56" r="14"/>
    <path class="t" d="M132 42c2-7 8-10 14-9-2 6-7 9-14 9z"/>
    <path class="p k" d="M52 58h104l-12 50H66z"/>
    <path class="l l--tenka" d="M80 68l4 30M104 68v30M128 68l-4 30"/>
    <path class="l" d="M22 40h18l14 74h84"/>
    <circle class="n" cx="70" cy="132" r="9"/><circle class="n" cx="128" cy="132" r="9"/>
    <circle class="p" cx="70" cy="132" r="3"/><circle class="p" cx="128" cy="132" r="3"/>
    ${jiskra(168, 36, 8)}${jiskra(170, 104, 5, 'os')}`,

  // Narození: kočárek
  kocarek: `${stin(100, 60)}
    <path class="p k" d="M48 76h104a52 40 0 0 1-104 0z"/>
    <path class="o k" d="M98 76V28a48 48 0 0 1 48 48z"/>
    <path class="l l--tenka" d="M98 52a24 24 0 0 1 24 24"/>
    <path class="l" d="M48 76l-10-22h-14"/>
    <circle class="n" cx="70" cy="130" r="12"/><circle class="n" cx="132" cy="130" r="12"/>
    <circle class="p" cx="70" cy="130" r="4"/><circle class="p" cx="132" cy="130" r="4"/>
    <path class="l l--tenka" d="M78 112l-6 8M124 112l6 8"/>
    <path class="o" d="M164 40c-4-6-14-4-12 4 1 5 12 12 12 12s11-7 12-12c2-8-8-10-12-4z"/>
    ${jiskra(40, 108, 7)}${jiskra(168, 82, 6, 'os')}`,

  // Mzdy: peněženka s bankovkou a mincemi
  penezenka: `${stin(100, 64)}
    <rect class="t k" x="56" y="30" width="80" height="44" rx="6" transform="rotate(-10 96 52)"/>
    <circle class="p" cx="96" cy="52" r="9" transform="rotate(-10 96 52)"/>
    <rect class="n" x="42" y="56" width="116" height="78" rx="14"/>
    <path class="o k" d="M118 78h44v34h-44a17 17 0 0 1 0-34z"/>
    <circle class="p" cx="122" cy="95" r="6"/>
    ${sloupekMinci(172, 3, 28)}
    ${mince(30, 120, 11)}
    ${jiskra(38, 40, 8)}${jiskra(168, 40, 6, 'os')}`,

  // Elektřina: zástrčka s kabelem a blesk
  blesk: `${stin(92, 56)}
    <path class="l" d="M92 116c0 14 18 18 34 14s30 4 34 10"/>
    <rect class="n" x="72" y="96" width="40" height="22" rx="6"/>
    <rect class="p k" x="60" y="52" width="64" height="50" rx="14"/>
    <rect class="n" x="74" y="30" width="8" height="24" rx="3"/><rect class="n" x="102" y="30" width="8" height="24" rx="3"/>
    <path class="m k" d="M150 24l-26 40h18l-10 34 28-44h-18z"/>
    <circle class="os" cx="92" cy="77" r="9"/>
    ${jiskra(40, 44, 8)}${jiskra(36, 112, 5, 'os')}`,

  // Bydlení: dům s klíčem
  dum: `${stin(98, 62)}
    <rect class="p k" x="52" y="70" width="92" height="66" rx="4"/>
    <path class="o k" d="M40 76l58-48 58 48z"/>
    <rect class="p k" x="118" y="34" width="14" height="24" rx="2"/>
    <rect class="n" x="84" y="100" width="26" height="36" rx="4"/>
    <circle class="m" cx="104" cy="118" r="2.5"/>
    <rect class="m k" x="62" y="88" width="16" height="16" rx="3"/><rect class="m k" x="118" y="88" width="16" height="16" rx="3"/>
    <circle class="p k" cx="98" cy="58" r="7"/>
    <g transform="rotate(30 166 104)">
      <circle class="m k" cx="166" cy="92" r="11"/><circle class="p" cx="166" cy="92" r="4"/>
      <path class="l" d="M166 103v26M166 120h7M166 127h5"/>
    </g>
    ${jiskra(34, 48, 8)}${jiskra(30, 118, 5, 'os')}`,

  // Svět (HDP na obyvatele): sloupky mincí jako stupně vítězů a špendlík
  svet: `${stin(100, 66)}
    ${sloupekMinci(62, 4)}${sloupekMinci(100, 8)}${sloupekMinci(138, 6)}
    <path class="o k" d="M100 14c-11 0-19 8-19 18 0 13 19 30 19 30s19-17 19-30c0-10-8-18-19-18z"/>
    <circle class="p" cx="100" cy="32" r="7"/>
    ${jiskra(38, 50, 8)}${jiskra(166, 56, 6, 'os')}`,

  // Veřejný dluh: budova státu (banka) s mincí
  banka: `${stin(100, 66)}
    <path class="o k" d="M36 60l64-34 64 34z"/>
    <rect class="n" x="40" y="60" width="120" height="12" rx="3"/>
    <rect class="p k" x="52" y="76" width="14" height="46" rx="3"/><rect class="p k" x="80" y="76" width="14" height="46" rx="3"/>
    <rect class="p k" x="106" y="76" width="14" height="46" rx="3"/><rect class="p k" x="134" y="76" width="14" height="46" rx="3"/>
    <rect class="n" x="32" y="122" width="136" height="16" rx="4"/>
    <circle class="m" cx="100" cy="46" r="7"/>
    ${mince(170, 30, 13)}
    ${jiskra(30, 36, 7, 'os')}`,

  // Náhradní: graf s lupou
  graf: `${stin(96, 60)}
    <rect class="p k" x="40" y="32" width="112" height="100" rx="12"/>
    <rect class="b" x="56" y="94" width="16" height="26" rx="3"/><rect class="os" x="80" y="78" width="16" height="42" rx="3"/>
    <rect class="m" x="104" y="64" width="16" height="56" rx="3"/><rect class="o" x="128" y="48" width="16" height="72" rx="3"/>
    <circle class="p k" cx="150" cy="104" r="20"/><path class="l l--silna" d="M164 118l14 14"/>
    ${jiskra(32, 30, 7)}`,
};

export const ilustrace = (id?: string) => (id && ILUSTRACE[id]) || ILUSTRACE.graf;
