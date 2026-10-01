// Hlasování „Který stát chceš příště?" běží přes Google Formulář a Google Tabulku.
// Postup nastavení je v návodu od Clauda. Dokud jsou hodnoty prázdné, sekce se na webu neukáže.
//
// formular: adresa z prohlížeče u formuláře v náhledu, končí /viewform → přepiš konec na /formResponse
//   např. https://docs.google.com/forms/d/e/1FAIpQLS.../formResponse
// pole: číslo otázky z předvyplněného odkazu, např. entry.123456789
// vysledky: adresa listu Výsledky zveřejněného jako CSV (Soubor → Sdílet → Publikovat na webu)
//   např. https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=123&single=true&output=csv

export const hlasovani = {
  formular: 'https://docs.google.com/forms/d/e/1FAIpQLSfPohhCwyzjXv0tGgGoWGZwGDWu_UfQHn8kFANnZjPvNpEU-Q/formResponse',
  pole: 'entry.1912608142',
  vysledky: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTB3F6W8RuUqyUrNDT5rA2XeNpQ6C_u_UIwk_q0JhuPkicx1_kX0KfazpAw1zcszs8qARghJCZAxcs/pub?gid=886591847&single=true&output=csv',
};

export const hlasovaniZapnute = Boolean(hlasovani.formular && hlasovani.pole && hlasovani.vysledky);
