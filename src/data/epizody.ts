// Díly série Česko vs. svět. a3 = třípísmenný kód země (ISO 3166-1).
export type Epizoda = { a3: string; dil: number; nazev: string; popis: string; datum: string; instagram: string };

export const epizody: Epizoda[] = [
  { a3: 'PRT', dil: 1, nazev: 'Portugalsko', popis: 'Skoro stejně lidí, úplně jiná země.', datum: '2026-06-30', instagram: 'https://www.instagram.com/reel/DaNi-6Nq_zA/' },
  { a3: 'HND', dil: 2, nazev: 'Honduras', popis: 'Stejně lidí, úplně jiný svět.', datum: '2026-07-07', instagram: 'https://www.instagram.com/reel/DafTOOVqrFf/' },
  { a3: 'SWE', dil: 3, nazev: 'Švédsko', popis: 'Česko je 11. nejbezpečnější země světa, Švédsko 35. Ve štěstí ale Švédové vedou.', datum: '2026-07-21', instagram: 'https://www.instagram.com/reel/DbDuo5FqJfY/' },
  { a3: 'SVK', dil: 4, nazev: 'Slovensko', popis: 'Kdysi jeden stát, dnes dvě země.', datum: '2026-08-02', instagram: 'https://www.instagram.com/reel/DbiWOkRIeec/' },
  { a3: 'HRV', dil: 5, nazev: 'Chorvatsko', popis: 'Od Dubrovníku po Rovinj: Chorvatsko v číslech vedle Česka.', datum: '2026-08-17', instagram: 'https://www.instagram.com/reel/DcI-11Cht3D/' },
  { a3: 'AZE', dil: 6, nazev: 'Ázerbájdžán', popis: 'Skoro stejně obyvatel, ale 85,5 % vývozu tvoří ropa a plyn.', datum: '2026-08-29', instagram: 'https://www.instagram.com/reel/Dcn_nhBonTt/' },
  { a3: 'TUN', dil: 7, nazev: 'Tunisko', popis: 'Dvakrát větší než Česko a druhý největší producent olivového oleje.', datum: '2026-09-10', instagram: 'https://www.instagram.com/reel/DdG5P8yoYwZ/' },
  { a3: 'BOL', dil: 8, nazev: 'Bolívie', popis: 'Vejde se do ní 14× Česko a má 37 úředních jazyků.', datum: '2026-09-24', instagram: 'https://www.instagram.com/reel/Ddq_wGyoRBc/' },
];
