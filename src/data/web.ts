// Nastavení pro vyhledávače a měření návštěvnosti. Prázdné hodnoty se na webu neprojeví.
//
// google: kód z Google Search Console (Přidat službu → Předpona adresy URL → ověření značkou HTML,
//   z <meta name="google-site-verification" content="TADY_JE_KÓD"> zkopíruj jen obsah content).
// seznam: kód ze Seznam Webmaster (webmaster.seznam.cz → Přidat web → ověření meta značkou seznam-wmt).
// goatcounter: název tvého účtu na goatcounter.com (zdarma, bez cookies, nepotřebuje cookie lištu),
//   např. 'datacesky' pro https://datacesky.goatcounter.com
// trasy: adresa Cloudflare Workeru, který počítá vzdálenost a čas po silnici přes Mapy.com
//   (návod v navody/trasy/README.md), např. 'https://datacesky-trasy.tvuj-ucet.workers.dev'.
//   Dokud je prázdná, mapa supermarketů ukazuje vzdálenost vzdušnou čarou.
export const web = {
  google: '',
  seznam: '',
  goatcounter: '',
  trasy: 'https://datacesky-trasy.reporting-annicka.workers.dev',
};
