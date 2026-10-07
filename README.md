# datacesky.cz

Web projektu @data.cesky: Astro, statický web na GitHub Pages.

## Spuštění

```sh
npm install
npm run dev      # náhled na localhost:4321
npm run build    # sestavení do dist/
```

Po `git push` do větve main se web sám nasadí.

## Kde co upravit

| Co | Soubor |
| :-- | :-- |
| Nový díl Česko vs. svět | `src/data/epizody.ts` (kód země, číslo dílu, popis, datum, odkaz na reel) |
| Vrstvy Mapy Česka | `src/data/vrstvy.ts` |
| Města na mapě | `src/data/mesta.json` (ČSÚ, Databáze demografických údajů za vybraná města) |
| Podklad mapy (popisky krajů, řeky, vrcholy) | `src/data/cesko-mapa.json` |
| Světová data pro glóbus | `src/data/svet.json` |
| Ostatní série | `src/data/serie.ts` |
| Hlasování o dalším dílu | `src/data/hlasovani.ts`, skript `navody/hlasovani-apps-script.gs` |
| Ověření pro Google, Seznam a měření návštěvnosti | `src/data/web.ts` |
| Náhledové obrázky pro sdílení | `public/og/` |

## Hlasování

Doporučené je zapojení přes Google Apps Script: hlasy se zapisují hned a web dostane výsledky okamžitě.
Postup je přímo v hlavičce souboru `navody/hlasovani-apps-script.gs`. Adresu webové aplikace (končí `/exec`)
vlož do `src/data/hlasovani.ts` jako `skript`. Dokud je prázdná, web používá Google Formulář a zveřejněnou tabulku.
