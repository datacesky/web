// Seznam her na stránce /hry/. Nová hra = nová položka tady + stránka v src/pages/hry/.
// id se používá i v dlouhodobém skóre (src/lib/hry.ts), takže se po spuštění hry už nemění.

export type HraNaWebu = {
  id: string;
  nazev: string;
  href: string;
  popis: string;
  rezimy: string[];
  obr: string;
  barva: string;
};

export const HRY: HraNaWebu[] = [
  {
    id: 'vlajky',
    nazev: 'Vlajky světa',
    href: '/hry/vlajky-sveta/',
    popis: 'Všech 197 států na kartičkách. Kostka určí, jestli hádáš hlavní město, měnu, jazyk, nebo sousedy.',
    rezimy: ['Desková hra pro 1–6 hráčů', 'Bleskovka na 60 sekund', 'Slepá mapa', 'Denní výzva', 'Studovna', 'Atlas karet'],
    obr: '/nahledy/hra.webp',
    barva: '#F08829',
  },
];
