// Všechna videa kromě Česko vs. svět (ta jsou v epizody.ts): série a samostatná videa.
//
// Nové video přidáš na konec seznamu dily (u série) nebo samostatna (video mimo sérii).
//   id:        krátký název bez diakritiky, třeba 'mhd-liberec'. Podle něj se hledá náhledovka.
//   datum:     den zveřejnění, rok-měsíc-den
//   instagram: odkaz na reel. Dokud je prázdný, karta vede na profil @data.cesky.
//   tema:      jedno až dvě témata ze seznamu TEMATA, podle nich jde videa filtrovat
//   ikona:     obrázek na vygenerované obálce (src/lib/ikony.ts), když chybí náhledovka
//   web:       odkaz na interaktivní verzi tady na webu (ukáže se pod kartou)
//   hledat:    další slova, pod kterými má jít video najít
//   brzy:      true = video je hotové, ale ještě nevyšlo. Karta se ukáže se štítkem „Brzy“ a bez odkazu.
//              Po zveřejnění řádek brzy smaž a doplň instagram a datum.
//
// Náhledovka: public/videa/{id}.webp (nebo .jpg, .png), ideálně 540 × 960 px.
// Díly Česko vs. svět mají id cesko-vs-svet-{číslo dílu}, třeba cesko-vs-svet-11.webp.

export type Tema = 'cesko' | 'svet' | 'lide' | 'penize' | 'historie' | 'doprava' | 'priroda' | 'kultura';

export const TEMATA: Record<Tema, { nazev: string; ikona: string }> = {
  cesko: { nazev: 'Česko', ikona: 'spendlik' },
  svet: { nazev: 'Svět', ikona: 'svet' },
  lide: { nazev: 'Lidé', ikona: 'lide' },
  penize: { nazev: 'Peníze', ikona: 'penezenka' },
  historie: { nazev: 'Historie', ikona: 'koruna' },
  doprava: { nazev: 'Doprava', ikona: 'tramvaj' },
  priroda: { nazev: 'Příroda', ikona: 'hory' },
  kultura: { nazev: 'Kultura', ikona: 'pohar' },
};

export type Video = {
  id: string; nazev: string; popis: string; datum: string; tema: Tema[];
  cislo?: number; instagram?: string; ikona?: string; web?: string; hledat?: string; brzy?: boolean;
};
// predpona: celý název dílu je predpona + nazev („24 hodin MHD: Brno“), v řadě série stačí „Brno“
export type Serie = { id: string; nazev: string; popis: string; ikona: string; predpona?: string; dily: Video[] };

export const serie: Serie[] = [
  {
    id: '24-hodin-mhd',
    nazev: '24 hodin MHD',
    predpona: '24 hodin MHD: ',
    popis: 'Jeden všední den městské dopravy od půlnoci do půlnoci. Každá tečka je jeden spoj přesně podle jízdního řádu.',
    ikona: 'tramvaj',
    dily: [
      { id: 'mhd-praha', cislo: 1, nazev: 'Praha', popis: 'V 7:35 jede naráz 1 238 spojů, za celý všední den jich vyjede 31 081.', datum: '2026-10-03', instagram: 'https://www.instagram.com/reel/DeCBr3Tqj5Q/', tema: ['doprava', 'cesko'], ikona: 'tramvaj', hledat: 'pid tramvaje metro autobusy praha mhd' },
      { id: 'mhd-brno', cislo: 2, nazev: 'Brno', popis: 'V 7:32 jede naráz 371 spojů, za celý všední den jich vyjede 9 674.', datum: '2026-10-04', tema: ['doprava', 'cesko'], ikona: 'tramvaj', hledat: 'ids jmk tramvaje trolejbusy brno mhd' },
      { id: 'mhd-ostrava', cislo: 3, nazev: 'Ostrava', popis: 'V 7:35 jede naráz 257 spojů. Na rozdíl od Brna tu tramvaje jezdí i v noci.', datum: '2026-10-22', tema: ['doprava', 'cesko'], ikona: 'tramvaj', hledat: 'dpo tramvaje poruba ostrava mhd' },
      { id: 'mhd-plzen', cislo: 4, nazev: 'Plzeň', popis: 'V 7:28 jede naráz 160 spojů. Trolejbusových spojů je za den víc než tramvajových.', datum: '2026-10-29', tema: ['doprava', 'cesko'], ikona: 'tramvaj', hledat: 'pmdp trolejbusy plzen mhd', brzy: true },
    ],
  },
  {
    id: 'ceske-rody',
    nazev: 'České rody',
    popis: 'Rody, které vládly českým zemím. Na jedné mapě jejich území, panovníci a to, jak se zemi za jejich vlády dařilo.',
    ikona: 'koruna',
    dily: [
      { id: 'premyslovci', cislo: 1, nazev: 'Přemyslovci', popis: 'Za víc než 400 let se na českém trůnu vystřídalo přes 30 Přemyslovců.', datum: '2026-10-20', tema: ['historie', 'cesko'], ikona: 'koruna', hledat: 'premysl otakar vaclav kral knize dynastie' },
      { id: 'lucemburkove', cislo: 2, nazev: 'Lucemburkové', popis: 'Přes 120 let vlády. Karel IV. se stal římským císařem a z Prahy udělal centrum celé říše.', datum: '2026-10-27', tema: ['historie', 'cesko'], ikona: 'koruna', hledat: 'karel iv jan lucembursky vaclav iv zikmund kral cisar dynastie', brzy: true },
    ],
  },
  {
    id: 'cesi-kteri-zmenili-svet',
    nazev: 'Češi, kteří změnili svět',
    popis: 'Příběhy Čechů, jejichž vynálezy a objevy dnes zná celý svět.',
    ikona: 'osoba',
    dily: [
      { id: 'otto-wichterle', cislo: 1, nazev: 'Otto Wichterle', popis: 'Měkké kontaktní čočky odlil doma na stroji ze stavebnice Merkur. První čtyři vznikly na Štědrý den 1961.', datum: '2026-10-25', tema: ['lide', 'historie'], ikona: 'osoba', hledat: 'kontaktni cocky silon vynalez vedec osobnosti', brzy: true },
    ],
  },
  {
    id: 'cesty-na-mape',
    nazev: 'Cesty na mapě',
    popis: 'Výpravy a cesty spojené s Českem, krok po kroku na mapě.',
    ikona: 'spendlik',
    dily: [
      { id: 'capi', nazev: 'Kam letí čeští čápi na zimu', popis: 'Devět čápů s vysílačkou: jedni letí přes Gibraltar, druzí přes Izrael. Domů se vrátilo šest.', datum: '2026-10-13', instagram: 'https://www.instagram.com/reel/Deb-U4ZBFvc/', tema: ['priroda', 'svet'], ikona: 'ptak', web: '/svet/#capi', hledat: 'cap capi migrace ptaci afrika' },
      { id: 'hanzelka-a-zikmund', nazev: 'Hanzelka a Zikmund v Tatře 87', popis: '1 290 dní, 111 000 km a 44 zemí. První velká výprava Hanzelky a Zikmunda přes Afriku a Ameriku.', datum: '2026-10-17', tema: ['historie', 'svet'], ikona: 'auto', hledat: 'tatra 87 cestovatele afrika amerika vyprava', brzy: true },
      { id: 'gaston', nazev: 'Gastonova cesta', popis: 'Lachtan z pražské zoo uplaval při povodni v roce 2002 přes 300 km až do Německa.', datum: '2026-10-24', tema: ['priroda', 'cesko'], ikona: 'vlna', hledat: 'lachtan zoo praha povoden 2002 vltava labe nemecko' },
    ],
  },
  {
    id: 'index-tydne',
    nazev: 'Index týdne',
    popis: 'Jeden světový index a místo, které v něm má Česko.',
    ikona: 'graf',
    dily: [
      { id: 'big-mac-index', nazev: 'Big Mac index', popis: 'Big Mac stojí v Česku 115 Kč, 19. nejvíc z 54 zemí.', datum: '2026-08-08', instagram: 'https://www.instagram.com/reel/DbxYpBWSa9a/', tema: ['penize', 'svet'], ikona: 'burger', hledat: 'mcdonalds ceny meny' },
      { id: 'index-vnimani-korupce', nazev: 'Index vnímání korupce', popis: 'Nejméně zkorumpované země světa v letech 2012 až 2025.', datum: '2026-08-19', instagram: 'https://www.instagram.com/reel/DcOSlsLBuVs/', tema: ['svet'], ikona: 'stit', hledat: 'cpi transparency international korupce' },
      { id: 'global-innovation-index', nazev: 'Global Innovation Index', popis: 'Švýcarsko je nejinovativnější zemí světa 16 let v řadě, Česko je 33. ze 139.', datum: '2026-10-10', instagram: 'https://www.instagram.com/reel/DeULIwJq965/', tema: ['svet', 'penize'], ikona: 'zarovka', hledat: 'inovace wipo' },
    ],
  },
  {
    id: 'kdyby-cesko-bylo-100-lidi',
    nazev: 'Kdyby Česko bylo 100 lidí',
    popis: 'Česko zmenšené na sto lidí.',
    ikona: 'lide',
    dily: [
      { id: 'sto-lidi-1', cislo: 1, nazev: 'Kdo jsme', popis: '51 žen a 49 mužů, 15 dětí, 64 dospělých a 21 seniorů.', datum: '2026-09-28', instagram: 'https://www.instagram.com/reel/Dd1Kq3yKcjc/', tema: ['lide', 'cesko'], hledat: 'obyvatele vek pohlavi 100 lidi' },
      { id: 'sto-lidi-2', cislo: 2, nazev: 'Jak jsme vzdělaní', popis: 'Vysokou školu má 19 ze 100, alespoň maturitu 53 a vyučených je třetina.', datum: '2026-10-08', instagram: 'https://www.instagram.com/reel/DePIV_LqUTf/', tema: ['lide', 'cesko'], hledat: 'vzdelani vysoka skola maturita scitani 100 lidi' },
    ],
  },
  {
    id: 'cesko-v-pohybu',
    nazev: 'Česko v pohybu',
    popis: 'Doprava po celém Česku na mapě: vlaky a silnice.',
    ikona: 'auto',
    dily: [
      { id: 'autem-z-prahy', nazev: 'Autem z Prahy', popis: 'Z centra Prahy dojedeš autem kamkoli v Česku nejpozději za 4 hodiny a 13 minut.', datum: '2026-10-11', instagram: 'https://www.instagram.com/reel/DeWt5bkhMKM/', tema: ['doprava', 'cesko'], ikona: 'auto', hledat: 'dalnice silnice dojezd izochrony' },
    ],
  },
];

// Videa mimo série
export const samostatna: Video[] = [
  { id: 'rostouci-ekonomiky', nazev: 'Nejrychleji rostoucí ekonomiky světa', popis: 'Guyana má dnes ekonomiku 13,9× větší než v roce 2000. Česko 1,8×.', datum: '2026-10-18', tema: ['penize', 'svet'], ikona: 'trend', hledat: 'hdp mmf ekonomika rust guyana' },
  { id: 'jak-clovek-obsadil-svet', nazev: 'Jak člověk obsadil svět', popis: 'Z Afriky až na Nový Zéland: 300 000 let lidské cesty na jedné mapě.', datum: '2026-10-19', tema: ['historie', 'svet'], ikona: 'svet', hledat: 'homo sapiens pravek neandertalci migrace zlaty kun' },
  { id: 'namorni-trasy', nazev: 'Hlavní námořní trasy světa', popis: 'Po moři se veze víc než 80 % světového obchodu. Šanghaj loni přeložila 55,1 milionu kontejnerů.', datum: '2026-10-19', tema: ['doprava', 'svet'], ikona: 'lod', hledat: 'lode pristavy kontejnery suez obchod logistika' },
  { id: 'snih', nazev: 'Kolik sněhu bývalo v Česku', popis: 'V zimách osmdesátých let měla polovina stanic aspoň 24 cm sněhu. Od roku 2020 je to 16 cm.', datum: '2026-10-20', tema: ['priroda', 'cesko'], ikona: 'snih', hledat: 'snih zima pocasi chmu klima' },
  { id: 'endemiti', nazev: 'Zvířata, která žijí jen v Česku', popis: 'Nežijí nikde jinde na světě. Jediný obratlovec mezi nimi nese jméno po Járovi Cimrmanovi.', datum: '2026-10-22', tema: ['priroda', 'cesko'], ikona: 'brouk', hledat: 'endemiti zvirata hmyz plzi mysice cimrman' },
  { id: 'evropa-v-ulicich', nazev: 'Evropa v ulicích', popis: 'Evropa protestuje kvůli cenám, Česko kvůli televizi. Na Staroměstském náměstí se sešlo asi 25 tisíc lidí.', datum: '2026-10-26', tema: ['svet', 'cesko'], ikona: 'lide', hledat: 'protesty demonstrace francie poplatky ceska televize' },
  { id: 'sance-narodit-se-v-cesku', nazev: 'Jaká je šance narodit se v Česku', popis: 'Zhruba 1 : 1 700. Z tisíce dětí narozených na světě připadne na Česko 0,6.', datum: '2026-10-26', tema: ['lide', 'svet'], ikona: 'kocarek', hledat: 'porodnost narozeni deti osn' },
  { id: 'verejnopravni-media', nazev: 'Jak se v Evropě platí veřejnoprávní média', popis: 'Poplatek vybírá 12 z 31 srovnávaných zemí, dalších 17 platí média ze státního rozpočtu.', datum: '2026-10-26', tema: ['svet', 'penize'], ikona: 'banka', hledat: 'poplatky ceska televize rozhlas ct cro', brzy: true },
  { id: 'nebezpecna-mista-prahy', nazev: 'Nejnebezpečnější místa Prahy', popis: 'Nejvíc násilných činů za deset let evidovala policie na Starém Městě, v okolí Dušní a Kozí.', datum: '2026-10-28', tema: ['cesko'], ikona: 'stit', hledat: 'kriminalita policie praha nasili mapa kriminality' },
  { id: 'hospody-v-cesku', nazev: 'Hospody v Česku', popis: 'Restaurací a hospod je v Česku 46 710, osmý nejvyšší počet v EU. Na jednu připadá asi 233 lidí.', datum: '2026-10-29', tema: ['cesko', 'kultura'], ikona: 'pivo', hledat: 'hospody pivo restaurace eurostat', brzy: true },
];
