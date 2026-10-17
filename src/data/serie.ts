// ikona: obrázek na vygenerované obálce (src/lib/ikony.ts). Vlastní náhledovku dílu dej do public/serie/
// jako {id-serie}-{pořadí dílu}.jpg, třeba index-tydne-1.jpg; díly Česko vs. svět jako cesko-vs-svet-9.jpg.
// web: odkaz na interaktivní verzi dílu tady na webu (ukáže se pod obálkou)
export type Dil = { cislo?: number; nazev: string; popis: string; datum: string; instagram?: string; ikona?: string; web?: string };
export type Serie = { id: string; nazev: string; popis: string; dily: Dil[] };

// Nový díl přidáš na konec seznamu dily. Datum je ve tvaru rok-měsíc-den.
export const serie: Serie[] = [
  {
    id: 'index-tydne',
    nazev: 'Index týdne',
    popis: 'Jeden světový index a místo, které v něm má Česko.',
    dily: [
      { nazev: 'Big Mac index', popis: 'Big Mac stojí v Česku 115 Kč, 19. nejvíc z 54 zemí.', datum: '2026-08-08', instagram: 'https://www.instagram.com/reel/DbxYpBWSa9a/', ikona: 'burger' },
      { nazev: 'Index vnímání korupce', popis: 'Nejméně zkorumpované země světa v letech 2012 až 2025.', datum: '2026-08-19', instagram: 'https://www.instagram.com/reel/DcOSlsLBuVs/', ikona: 'stit' },
      { nazev: 'Global Innovation Index', popis: 'Švýcarsko je nejinovativnější zemí světa 16 let v řadě, Česko je 33. ze 139.', datum: '2026-10-10', instagram: 'https://www.instagram.com/reel/DeULIwJq965/', ikona: 'zarovka' },
    ],
  },
  {
    id: 'kdyby-cesko-bylo-100-lidi',
    nazev: 'Kdyby Česko bylo 100 lidí',
    popis: 'Česko zmenšené na sto lidí.',
    dily: [
      { cislo: 1, nazev: 'Kdo jsme', popis: '51 žen a 49 mužů, 15 dětí, 64 dospělých a 21 seniorů.', datum: '2026-09-28', instagram: 'https://www.instagram.com/reel/Dd1Kq3yKcjc/' },
      { cislo: 2, nazev: 'Jak jsme vzdělaní', popis: 'Vysokou školu má 19 ze 100, alespoň maturitu 53 a vyučených je třetina.', datum: '2026-10-08', instagram: 'https://www.instagram.com/reel/DePIV_LqUTf/' },
    ],
  },
  {
    id: 'cesko-v-pohybu',
    nazev: 'Česko v pohybu',
    popis: 'Doprava na mapě: vlaky, MHD a silnice během jednoho dne.',
    dily: [
      { nazev: '24 hodin pražské MHD', popis: 'V 7:35 jede naráz 1 238 spojů, za celý všední den jich vyjede 31 081.', datum: '2026-10-03', instagram: 'https://www.instagram.com/reel/DeCBr3Tqj5Q/', ikona: 'tramvaj' },
      { nazev: 'Autem z Prahy', popis: 'Z centra Prahy dojedeš autem kamkoli v Česku nejpozději za 4 hodiny a 13 minut.', datum: '2026-10-11', instagram: 'https://www.instagram.com/reel/DeWt5bkhMKM/', ikona: 'auto' },
    ],
  },
  {
    id: 'cesty-na-mape',
    nazev: 'Cesty na mapě',
    popis: 'Výpravy a cesty spojené s Českem, krok po kroku na mapě.',
    dily: [
      { nazev: 'Kam letí čeští čápi na zimu', popis: 'Devět čápů s vysílačkou: jedni letí přes Gibraltar, druzí přes Izrael. Domů se vrátilo šest.', datum: '2026-10-13', instagram: 'https://www.instagram.com/reel/Deb-U4ZBFvc/', ikona: 'ptak', web: '/svet/#capi' },
    ],
  },
];
