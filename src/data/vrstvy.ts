import type { Vrstva } from '../lib/mapa';

// Klíče krajů: praha, stredocesky, jihocesky, plzensky, karlovarsky, ustecky, liberecky,
// kralovehradecky, pardubicky, vysocina, jihomoravsky, olomoucky, zlinsky, moravskoslezsky
//
// Novou vrstvu přidáš tak, že sem vložíš další objekt. První vrstva v seznamu se ukáže jako výchozí.
// typ 'ciselna' = barevná škála podle hodnoty, typ 'kategorie' = každá hodnota má svou barvu.
// soucet: true jen u hodnot, které se dají sčítat (počty lidí, peníze). U procent a průměrů vynech.

export const vrstvy: Vrstva[] = [
  {
    id: 'obyvatele',
    nazev: 'Počet obyvatel',
    popis: 'Kolik lidí žije v kraji',
    typ: 'ciselna',
    jednotka: 'obyvatel',
    desetinna: 0,
    obdobi: 'k 31. 12. 2025',
    zdroj: 'ČSÚ',
    zdrojUrl:
      'https://csu.gov.cz/docs/107799/70d5f2fe-f0b9-262e-9953-3de1e2f1ffbc/lide-pocet_obyvatel.pdf',
    soucet: true,
    hodnoty: {
      stredocesky: 1477134,
      praha: 1407084,
      jihomoravsky: 1230516,
      moravskoslezsky: 1176380,
      ustecky: 805943,
      jihocesky: 652896,
      olomoucky: 631480,
      plzensky: 614683,
      zlinsky: 577515,
      kralovehradecky: 554668,
      pardubicky: 530950,
      vysocina: 515953,
      liberecky: 448610,
      karlovarsky: 292027,
    },
  },
  {
    id: 'jmena-chlapci',
    nazev: 'Nejoblíbenější jméno chlapců',
    popis: 'Nejčastější jméno narozených chlapců',
    typ: 'kategorie',
    obdobi: '2023',
    zdroj: 'ČSÚ',
    zdrojUrl: 'https://csu.gov.cz/', // DOPLŇ přesný odkaz na tabulku jmen
    barvy: { Jakub: '#1B2A4A', 'Matyáš': '#F08829' },
    hodnoty: {
      praha: 'Matyáš',
      kralovehradecky: 'Matyáš',
      pardubicky: 'Matyáš',
      stredocesky: 'Jakub',
      jihocesky: 'Jakub',
      plzensky: 'Jakub',
      karlovarsky: 'Jakub',
      ustecky: 'Jakub',
      liberecky: 'Jakub',
      vysocina: 'Jakub',
      jihomoravsky: 'Jakub',
      olomoucky: 'Jakub',
      zlinsky: 'Jakub',
      moravskoslezsky: 'Jakub',
    },
  },
];
