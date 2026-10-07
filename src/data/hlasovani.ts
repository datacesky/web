// Hlasování „Který stát chceš v dalším dílu Česko vs. svět?"
//
// Doporučené zapojení: skript: adresa webové aplikace Google Apps Script (končí /exec).
//   Hlasy se zapisují do tabulky hned a web dostane výsledky okamžitě i s potvrzením.
//   Kód skriptu a postup je v souboru navody/hlasovani-apps-script.gs.
//
// Záložní zapojení (když skript chybí): Google Formulář + tabulka zveřejněná jako CSV.
//   formular: adresa formuláře, konec /viewform přepsaný na /formResponse
//   pole: číslo otázky z předvyplněného odkazu, např. entry.123456789
//   vysledky: list Výsledky zveřejněný jako CSV (Soubor → Sdílet → Publikovat na webu)
//   Výsledky se tu obnovují se zpožděním několika minut.

export const hlasovani = {
  skript: 'https://script.google.com/macros/s/AKfycbzKh6BHwfaxtCscIiCVLNqY7IsluSoxjdMlirbLL5kt-QeGNb64Tx6kOCk7jYMeZLm2Ww/exec',
  formular: 'https://docs.google.com/forms/d/e/1FAIpQLSfPohhCwyzjXv0tGgGoWGZwGDWu_UfQHn8kFANnZjPvNpEU-Q/formResponse',
  pole: 'entry.1912608142',
  vysledky: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTB3F6W8RuUqyUrNDT5rA2XeNpQ6C_u_UIwk_q0JhuPkicx1_kX0KfazpAw1zcszs8qARghJCZAxcs/pub?gid=886591847&single=true&output=csv',
};

export const hlasovaniZapnute = Boolean(hlasovani.skript || (hlasovani.formular && hlasovani.pole && hlasovani.vysledky));
