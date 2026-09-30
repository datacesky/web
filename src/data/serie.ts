export type Dil = { cislo?: number; nazev: string; popis: string; datum: string; instagram?: string };
export type Serie = { id: string; nazev: string; popis: string; dily: Dil[] };

// Nový díl přidáš na konec seznamu dily. Datum je ve tvaru rok-měsíc-den.
export const serie: Serie[] = [
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
