# Trasy na mapě supermarketů (Mapy.com přes Cloudflare Worker)

Mapa supermarketů umí u nejbližších prodejen ukázat čas a vzdálenost cesty pěšky a autem (Matrix routing)
a po kliknutí na **Trasa** nakreslit cestu k prodejně na mapu (Routing). Obojí počítá Mapy.com. Mapy.com chtějí, aby API klíč nebyl vidět v kódu stránky, a repozitář webu je veřejný.
Proto klíč drží malý Cloudflare Worker (`worker.js`) a web se ptá jen jeho.

Dokud v `src/data/web.ts` není vyplněné `trasy`, mapa ukazuje vzdálenost vzdušnou čarou a trasu jako přímou čáru.
Nic se nerozbije.

**Po změně `worker.js`** (třeba když přibyla trasa na mapu) ho stačí znovu nahrát, klíč i adresa zůstanou:

```
cd ~/data-cesky-web/navody/trasy
```

```
npx wrangler deploy
```

## Co Worker hlídá

- Odpovídá jen stránkám z `POVOLENE` ve `wrangler.toml` (datacesky.cz).
- Pustí jen dotaz z Česka (s rezervou kolem hranic), nejvýš 25 prodejen a jen trasu pěšky nebo autem.
- Polohu zaokrouhlí asi na 10 m a stejný dotaz si týden pamatuje, takže se kredity neplýtvají.
- Jeden dotaz na časy stojí 40 kreditů, jedna nakreslená trasa 4 kredity. Základní tarif má 250 000 kreditů měsíčně zdarma, to je asi 6 000 hledání.
  Když dojdou, trasy do konce měsíce nefungují a web ukáže vzdálenost vzdušnou čarou. Bez tvého souhlasu se nic neplatí.
  Pro veřejné projekty nabízí Mapy.com rozšířený tarif s 10 miliony kreditů zdarma, dá se o něj požádat v účtu.

## Nastavení (jednou)

1. **Klíč Mapy.com:** na https://developer.mapy.com/account/ se přihlas účtem Seznam, vytvoř nový projekt
   (třeba „datacesky.cz“) a zkopíruj API klíč, který se v něm sám vytvoří.

2. **Worker:** v terminálu ve složce webu postupně:

```
cd ~/data-cesky-web/navody/trasy
```

```
npx wrangler login
```

```
npx wrangler deploy
```

Na konci vypíše adresu, třeba `https://datacesky-trasy.tvuj-ucet.workers.dev`. Ulož si ji.

```
npx wrangler secret put MAPY_KLIC
```

Až se zeptá, vlož klíč z Mapy.com a potvrď Enterem. Klíč se uloží jen u Cloudflaru, do repozitáře se nedostane.

3. **Web:** adresu Workeru vlož do `src/data/web.ts` jako `trasy: 'https://datacesky-trasy.tvuj-ucet.workers.dev'`
   a web nahraj jako obvykle (`git push`).

## Náhled na počítači

Worker odpovídá jen datacesky.cz. Kdybys chtěl trasy zkoušet i na `http://localhost:4321`, přidej ve `wrangler.toml`
do `POVOLENE` na konec `,http://localhost:4321` a znovu spusť `npx wrangler deploy`.
