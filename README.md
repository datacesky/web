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
| Vývoj v čase a „Porovnej se“ u grafů | `src/data/grafy/*.json`, obnoví je `python3 skripty/data_grafu.py` |
| Novinky z dat | `src/content/novinky/RRRR-MM.md`, připravuje je `skripty/novinky.py` |
| 3D model Česka | `public/data/cesko3d.json`, obnoví ho `python3 skripty/data_3d.py` |
| Vlaky za 24 hodin (Mapa Česka) | `public/data/vlaky.json`, vyrobí ho `python3 skripty/data_vlaky.py` z GTFS jízdního řádu (postup je v hlavičce skriptu) |
| Cesta čápů (Svět) | `src/data/capi.json`, vyrobí ho `python3 skripty/data_capi.py` ze zamčených dat `skripty/capi_data.py` |
| Upoutávka „Nově na webu“ na úvodu | `src/components/uvod/NoveNaWebu.astro`, náhledy v `public/nahledy/` |
| Odkaz z dílu série na interaktivní verzi | pole `web` u dílu v `src/data/serie.ts` |
| Vrstevnice v úvodu | `public/vrstevnice.svg`, generuje `navody/vrstevnice.py` |
| Hledání na webu (⌘K / Ctrl+K) | okno `src/components/Hledani.astro`, rejstřík `src/pages/hledani.json.ts` (skládá se sám ze zemí, krajů, měst, vrstev, žebříčků, grafů, novinek a dílů; přezdívky zemí jsou nahoře v souboru) |
| Hlavička, spodní lišta na mobilu a patička | `src/layouts/Base.astro`, styly v `src/styles/global.css` |
| Barvy a tmavý režim | proměnné nahoře v `src/styles/global.css` (světlé v `:root`, tmavé v bloku `:root[data-tema='tmavy']`); přepínač je v hlavičce a v patičce (`Base.astro`), skripty s canvasem berou barvy přes `src/lib/tema.ts` |

## Novinky z dat

Jednou měsíčně (12. den v 8:00) spustí GitHub skript `skripty/novinky.py`. Ten stáhne čerstvá čísla
z otevřených dat ČSÚ (DataStat) a Eurostatu, vybere to nejzajímavější a pošle to jako **návrh ke schválení**
(Pull request „Novinky z dat: RRRR-MM“). Projdi ho, případně uprav text a klikni **Merge**. Až pak se
novinky objeví na webu. Ručně jde spustit v záložce Actions → Novinky z dat → Run workflow.

Sleduje devět ukazatelů: inflace (ČSÚ CEN0101H + Eurostat prc_hicp_minr), pohonné hmoty (CENPHMT),
nezaměstnanost v EU (Eurostat une_rt_m), průměrná mzda (MZDQ1), HDP (Eurostat namq_10_gdp),
narození (OBY01CRQM), turisté (CRU02M), průmysl (PRU01B) a maloobchod (OBC01). Ukazatel, který od minulého
vydání nemá nová data, se vynechá. Úvodní stránka ukazuje šest nejčerstvějších položek napříč vydáními
a pás s čísly pod hlavičkou.

Každá položka má v souboru i řádek `graf:` s daty pro malý graf (JSON na jednom řádku). Položku smažeš
tak, že odstraníš celý její blok od `- id:` po `graf:` včetně.

Aby GitHub mohl návrh vytvořit, musí být v Settings → Actions → General → Workflow permissions
zapnuté **Read and write permissions** a **Allow GitHub Actions to create and approve pull requests**.

## 3D model Česka

Data pro 3D model na Mapě Česka jsou v `public/data/cesko3d.json`. Obnovíš je (jednou ročně, až ČSÚ zveřejní nový počet
obyvatel obcí) takhle, každý příkaz zvlášť:

```
pip install shapely pyproj
```

```
python3 skripty/data_3d.py
```

Skript stáhne asi 500 MB dat (ČSÚ, hranice obcí, Natural Earth), uloží si je do dočasné složky a trvá pár minut.
Samotný model je v `src/lib/cesko3d.ts` (three.js) a `src/components/Cesko3D.astro`.

## Série a náhledovky

Stránka Série ukazuje každý díl jako obálku 9:16. Bez obrázku se obálka vygeneruje sama (vlajky, název, číslo dílu).
Vlastní náhledovku dáš do složky `public/serie/` (JPG, PNG nebo WebP, ideálně 720 × 1280 px):

- `cesko-vs-svet-9.jpg` = díl 9 série Česko vs. svět
- `index-tydne-1.jpg`, `kdyby-cesko-bylo-100-lidi-1.jpg` = díly ostatních sérií v pořadí ze `src/data/serie.ts`

Nový díl Česko vs. svět přidáš do `src/data/epizody.ts`, ostatní do `src/data/serie.ts`.

## Data u grafů

Vývoj v čase (vysokoškoláci, turisté) a průměrná mzda u „Porovnej se“ jsou v `src/data/grafy/`.
Obnovíš je příkazem `python3 skripty/data_grafu.py` (potřebuje jen Python 3). Změny se ukážou
v `git diff`, zkontroluj je před pushnutím.

## Hlasování

Doporučené je zapojení přes Google Apps Script: hlasy se zapisují hned a web dostane výsledky okamžitě.
Postup je přímo v hlavičce souboru `navody/hlasovani-apps-script.gs`. Adresu webové aplikace (končí `/exec`)
vlož do `src/data/hlasovani.ts` jako `skript`. Dokud je prázdná, web používá Google Formulář a zveřejněnou tabulku.
