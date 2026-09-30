export type Dil = { cislo?: number; nazev: string; popis: string; datum: string; instagram?: string };
export type Serie = { id: string; nazev: string; popis: string; dily: Dil[] };

// Nový díl přidáš na konec seznamu dily. Datum je ve tvaru rok-měsíc-den.
export const serie: Serie[] = [
  {
    id: 'cesko-vs-svet',
    nazev: 'Česko vs. svět',
    popis: 'Česko vedle jedné jiné země. Lidé, peníze, příroda a kultura.',
    dily: [
      { cislo: 1, nazev: 'Portugalsko', popis: 'Skoro stejně lidí, úplně jiná země.', datum: '2026-06-30', instagram: 'https://www.instagram.com/reel/DaNi-6Nq_zA/' },
      { cislo: 2, nazev: 'Honduras', popis: 'Stejně lidí, úplně jiný svět.', datum: '2026-07-07', instagram: 'https://www.instagram.com/reel/DafTOOVqrFf/' },
      { cislo: 3, nazev: 'Švédsko', popis: 'Česko je 11. nejbezpečnější země světa, Švédsko 35. Ve štěstí ale Švédové vedou.', datum: '2026-07-21', instagram: 'https://www.instagram.com/reel/DbDuo5FqJfY/' },
      { cislo: 4, nazev: 'Slovensko', popis: 'Kdysi jeden stát, dnes dvě země.', datum: '2026-08-02', instagram: 'https://www.instagram.com/reel/DbiWOkRIeec/' },
      { cislo: 5, nazev: 'Chorvatsko', popis: 'Od Dubrovníku po Rovinj: Chorvatsko v číslech vedle Česka.', datum: '2026-08-17', instagram: 'https://www.instagram.com/reel/DcI-11Cht3D/' },
      { cislo: 6, nazev: 'Ázerbájdžán', popis: 'Skoro stejně obyvatel, ale 85,5 % vývozu tvoří ropa a plyn.', datum: '2026-08-29', instagram: 'https://www.instagram.com/reel/Dcn_nhBonTt/' },
      { cislo: 7, nazev: 'Tunisko', popis: 'Dvakrát větší než Česko a druhý největší producent olivového oleje.', datum: '2026-09-10', instagram: 'https://www.instagram.com/reel/DdG5P8yoYwZ/' },
      { cislo: 8, nazev: 'Bolívie', popis: 'Vejde se do ní 14× Česko a má 37 úředních jazyků.', datum: '2026-09-24', instagram: 'https://www.instagram.com/reel/Ddq_wGyoRBc/' },
    ],
  },
  {
    id: 'index-tydne',
    nazev: 'Index týdne',
    popis: 'Jeden světový index a místo, které v něm má Česko.',
    dily: [
      { nazev: 'Big Mac index', popis: 'Big Mac stojí v Česku 115 Kč, 19. nejvíc z 54 zemí.', datum: '2026-08-08', instagram: 'https://www.instagram.com/reel/DbxYpBWSa9a/' },
      { nazev: 'Index vnímání korupce', popis: 'Nejméně zkorumpované země světa v letech 2012 až 2025.', datum: '2026-08-19', instagram: 'https://www.instagram.com/reel/DcOSlsLBuVs/' },
    ],
  },
  {
    id: 'kdyby-cesko-bylo-100-lidi',
    nazev: 'Kdyby Česko bylo 100 lidí',
    popis: 'Česko zmenšené na sto lidí.',
    dily: [
      { cislo: 1, nazev: 'Kdo jsme', popis: '51 žen a 49 mužů, 15 dětí, 64 dospělých a 21 seniorů.', datum: '2026-09-28', instagram: 'https://www.instagram.com/reel/Dd1Kq3yKcjc/' },
    ],
  },
];
