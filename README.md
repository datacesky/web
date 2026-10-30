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
| Ostatní série a samostatná videa | `src/data/serie.ts` (série, díly, témata, odkazy na reely), stránka `src/pages/videa.astro` |
| Náhledovky videí | `public/videa/{id}.webp` (id videa ze `serie.ts`, díly Česko vs. svět `cesko-vs-svet-11.webp`) |
| Konflikty na glóbusu | `src/data/konflikty.ts` (návod na aktualizaci je nahoře v souboru) |
| Supermarkety na mapě | `public/data/obchody.json`, vyrobí ho `python3 skripty/data_obchody.py export.geojson` (postup v hlavičce skriptu) |
| Sídla největších firem | tabulka `SIDLA` v `src/components/FirmyNaMape.astro` |
| Loga firem a obchodů | `public/loga/{název bez diakritiky}.png`, třeba `penny.png`, `skoda-auto.png`; v grafech a mapách se ukážou samy |
| Hlasování o dalším dílu | `src/data/hlasovani.ts`, skript `navody/hlasovani-apps-script.gs` |
| Ověření pro Google, Seznam a měření návštěvnosti | `src/data/web.ts` |
| Náhledové obrázky pro sdílení | `public/og/` |
| Vývoj v čase a „Porovnej se“ u grafů | `src/data/grafy/*.json`, obnoví je `python3 skripty/data_grafu.py` |
| Novinky z dat | `src/content/novinky/RRRR-MM.md`, připravuje je `skripty/novinky.py`, stránka `src/pages/novinky.astro`, hlavní novinka `src/components/NovinkaHlavni.astro` |
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
z otevřených dat ČSÚ (DataStat), Eurostatu a Světové banky, vybere to nejzajímavější a pošle to jako
**návrh ke schválení** (Pull request „Novinky z dat: RRRR-MM“). Projdi ho, případně uprav text a klikni **Merge**.
Až pak se novinky objeví na webu.

**Nová data hned, bez čekání na 12.:** záložka Actions → Novinky z dat → Run workflow. Když už vydání
za tento měsíc vyšlo, nepřepíše se: vznikne samostatné vydání `RRRR-MM-DD` („říjen 2026, 2. vydání“)
jen s tím, co od minula přibylo. Když nic nového není, návrh nevznikne.

Sleduje tyhle ukazatele (ukazatel, který od minulého vydání nemá nová data, se vynechá):

| Oblast | Ukazatele |
| :-- | :-- |
| Česko | inflace (ČSÚ CEN0101H), pohonné hmoty (CENPHMT), průměrná mzda (MZDQ1), narození (OBY01CRQM), turisté (CRU02M), průmysl (PRU01B), maloobchod (OBC01) |
| Evropa | nezaměstnanost (Eurostat une_rt_m), HDP (namq_10_gdp), inflace v zemích EU (prc_hicp_minr), ceny bydlení (prc_hpi_q), ceny elektřiny pro domácnosti (nrg_pc_204), veřejný dluh (gov_10q_ggdebt) |
| Svět | HDP na obyvatele v paritě kupní síly (Světová banka NY.GDP.PCAP.PP.CD), růst HDP (NY.GDP.MKTP.KD.ZG); vycházejí jednou ročně |

**Stránka Novinky:** nahoře velká **hlavní novinka měsíce**, pod ní ostatní novinky posledního vydání s filtrem
Česko / Evropa / Svět a dole **archiv starších vydání** (rozbalovací, nic se nemaže). Úvodní stránka ukazuje
šest nejčerstvějších položek napříč vydáními, hlavní novinka je první.

Úpravy v souboru vydání `src/content/novinky/…md` (v návrhu: Files changed → tři tečky → Edit file):

- **Jiná hlavní novinka:** v řádku `hlavni:` přepiš id na id jiné položky. Skript vybírá nejzajímavější položku,
  ale nikdy stejný ukazatel jako minulý měsíc.
- **Delší text k hlavní novince:** pod její `text:` přidej `pribeh: "…"` (odstavce odděl `\n\n`).
- **Obrázek k hlavní novince:** soubor dej do `public/novinky/` (JPG nebo WebP, ideálně 2100 × 800 px) a k položce
  přidej `obrazek: "/novinky/nazev.jpg"` a `obrazekPopis: "co je na obrázku"`. Bez obrázku je vedle textu velký graf.
- **Smazání položky:** odstraň celý její blok od `- id:` po `graf:` včetně.

Každá položka má v souboru i řádek `graf:` s daty pro graf (JSON na jednom řádku) a `oblast:` (cesko, evropa, svet).

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

## Videa a náhledovky

Stránka Videa (`/videa/`, stará adresa `/serie/` na ni přesměruje) ukazuje všechna videa: nejnovější nahoře,
série jako vodorovné řady a pod nimi ostatní videa. Nahoře je hledání a filtr podle série nebo tématu.
Filtr jde poslat odkazem: `/videa/#ceske-rody`, `/videa/#t=historie`, `/videa/#q=brno`.

- Nový díl Česko vs. svět přidáš do `src/data/epizody.ts`, ostatní videa do `src/data/serie.ts` (u série do `dily`,
  video mimo sérii do `samostatna`). Grafy s odkazem na reel (`src/content/grafy`) se mezi videa přidají samy.
- Dokud video nemá odkaz na Instagram, karta vede na profil a video se neukáže jako nejnovější.
- Náhledovka: `public/videa/{id}.webp` (nebo JPG, PNG), ideálně 540 × 960 px. Bez ní se obálka vygeneruje sama.
- Štítek „Nové“ mají videa z posledních deseti dnů.

## Data u grafů

Vývoj v čase (vysokoškoláci, turisté) a průměrná mzda u „Porovnej se“ jsou v `src/data/grafy/`.
Obnovíš je příkazem `python3 skripty/data_grafu.py` (potřebuje jen Python 3). Změny se ukážou
v `git diff`, zkontroluj je před pushnutím.

## Hlasování

Tabulka ukazuje celkové počty hlasů ze všech kol. Země, které už mají díl v `src/data/epizody.ts`, z výběru,
z tabulky i ze součtu hlasů zmizí samy. Hlasovat jde jednou za díl: po přidání dalšího dílu může každý hlasovat znovu.

Doporučené je zapojení přes Google Apps Script: hlasy se zapisují hned a web dostane výsledky okamžitě.
Postup je přímo v hlavičce souboru `navody/hlasovani-apps-script.gs`. Adresu webové aplikace (končí `/exec`)
vlož do `src/data/hlasovani.ts` jako `skript`. Dokud je prázdná, web používá Google Formulář a zveřejněnou tabulku.
