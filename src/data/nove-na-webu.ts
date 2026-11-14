// Co nového přibylo na webu. Úvodní stránka to ukazuje v kapitolách příběhu s glóbusem
// (kapitola: svet, zebricky, evropa nebo cesko). Náhledy v public/nahledy/ jsou snímky přímo z těch stránek (720 × 440 px).
export type Novinka = { kapitola: 'svet' | 'zebricky' | 'evropa' | 'cesko'; href: string; obr: string; titul: string; text: string };

export const noveNaWebu: Novinka[] = [
  { kapitola: 'svet', href: '/svet/#v=konflikty', obr: '/nahledy/konflikty.webp', titul: 'Konflikty ve světě', text: 'Kdo s kým bojuje a od kdy, na glóbusu.' },
  { kapitola: 'svet', href: '/svet/#capi', obr: '/nahledy/capi.webp', titul: 'Cesta čápů do Afriky', text: 'Devět čápů z Česka se satelitní vysílačkou.' },
  { kapitola: 'cesko', href: '/mapa/#v=vlaky', obr: '/nahledy/vlaky.webp', titul: 'Vlaky za 24 hodin', text: 'Každá tečka je jeden vlak podle jízdního řádu.' },
];
