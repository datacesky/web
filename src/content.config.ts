import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const grafy = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/grafy' }),
  schema: z.object({
    titul: z.string(),
    perex: z.string(),
    datum: z.date(),
    tema: z.enum([
      'Peníze',
      'Obyvatelstvo',
      'Česko vs. svět',
      'Historie',
      'Kultura',
      'Sport',
      'Mapy',
      'Cestování',
    ]),
    serie: z.string().optional(),
    zdroj: z.string(),
    zdrojUrl: z.string().url(),
    dataStazena: z.date().optional(),
    dataOtevrena: z.boolean().default(false),
    jednotka: z.string(),
    // true = hodnoty se dají sčítat (majetek, počty). U procent a průměrů nech false.
    soucet: z.boolean().default(false),
    // Pevný počet desetinných míst v grafu, např. 1 → 36,0. Když chybí, ukáže se nejvýš jedno.
    desetinna: z.number().int().min(0).max(3).optional(),
    popisGrafu: z.string().optional(),
    metodika: z.string().optional(),
    obrazek: z.string().optional(),
    dataSoubor: z.string().optional(),
    instagram: z.string().url().optional(),
    tiktok: z.string().url().optional(),
    // Barvy kategorií: orange, navy, teal, slate nebo hex kód.
    barvy: z.record(z.string(), z.string()).optional(),
    // Jak graf vypadá: pruhy (výchozí), nebo piktogramy (1 ikona = zaIkonu kusů)
    forma: z.enum(['pruhy', 'piktogramy']).default('pruhy'),
    zaIkonu: z.number().positive().optional(),
    // Vývoj v čase: název souboru v src/data/grafy/ (bez .json), generuje skripty/data_grafu.py
    vyvoj: z.enum(['vysokoskolaci', 'turiste']).optional(),
    // Kolik řádků ukázat ve vývoji v čase (nejlepší v daném roce); bez něj všechny
    vyvojPocet: z.number().int().positive().optional(),
    // „Porovnej se" pod grafem
    porovnej: z.enum(['zeme-vs', 'zeme-hoste', 'mzda-majetek', 'mzda-trzby', 'obyvatele']).optional(),
    // Výchozí země pro porovnání (kód ISO A3, třeba SVK)
    porovnejVychozi: z.string().optional(),
    polozky: z
      .array(
        z.object({
          nazev: z.string(),
          hodnota: z.number(),
          kategorie: z.string().optional(),
        })
      )
      .min(2),
  }),
});

// Novinky z dat: vydání připravuje skripty/novinky.py (GitHub Action jednou měsíčně jako návrh ke schválení)
const novinky = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/novinky' }),
  schema: z.object({
    titul: z.string(),
    datum: z.date(),
    // id hlavní novinky vydání (velká karta nahoře); když chybí, je hlavní první položka
    hlavni: z.string().optional(),
    // Souhrn měsíce lidskou řečí: titulek a perex na úvodní stránce, celý souhrn nahoře na stránce Novinky.
    // Skládá ho skripty/novinky.py z nejnovějších čísel, v návrhu ke schválení jde přepsat.
    souhrn: z
      .object({
        titulek: z.string(),
        // 2–3 věty: na úvodní stránce i nahoře v Novinkách
        perex: z.string(),
        // volitelný delší úvod jen na stránce Novinky (odstavce odděl prázdným řádkem \n\n)
        text: z.string().optional(),
        // poznámka pro kontrolu v návrhu, na webu se neukazuje
        zkontroluj: z.string().optional(),
        body: z
          .array(
            z.object({
              id: z.string(),
              tema: z.string(),
              ikona: z.string().optional(),
              // jak zpráva vyznívá pro lidi: barva štítku
              ton: z.enum(['dobre', 'spatne', 'neutralni']).default('neutralni'),
              stav: z.string(),
              cislo: z.string(),
              popisCisla: z.string().optional(),
              // jedna věta lidskou řečí: co to znamená v praxi
              veta: z.string(),
              text: z.string(),
              // malé srovnání v pruzích: [popisek, hodnota, barva] – cz oranžová, eu modrá, svet šedomodrá, jine béžová
              srovnani: z
                .object({
                  popis: z.string(),
                  jednotka: z.string(),
                  desetinna: z.number().int().min(0).max(3).default(1),
                  pruhy: z.array(z.tuple([z.string(), z.number(), z.enum(['cz', 'eu', 'svet', 'jine'])])).min(1),
                })
                .optional(),
              zdroj: z.string(),
              url: z.string().url(),
              // id novinky s grafem a detailem (odkaz /novinky/#n-id)
              novinka: z.string().optional(),
            })
          )
          .min(1),
      })
      .optional(),
    polozky: z
      .array(
        z.object({
          id: z.string(),
          obdobi: z.string(),
          nadpis: z.string(),
          cislo: z.string(),
          popisCisla: z.string().optional(),
          text: z.string(),
          zdroj: z.string(),
          sada: z.string(),
          url: z.string().url(),
          // krátký štítek a změna pro pás s čísly na úvodní stránce
          stitek: z.string().optional(),
          zmena: z.string().optional(),
          smer: z.enum(['nahoru', 'dolu', 'stejne']).optional(),
          // ikona karty (viz src/lib/ikony.ts)
          ikona: z.string().optional(),
          // čeho se novinka týká: Česko (data ČSÚ), Evropa (srovnání zemí EU), Svět (srovnání zemí světa)
          oblast: z.enum(['cesko', 'evropa', 'svet']).default('cesko'),
          // jen u hlavní novinky: delší text místo pole text
          pribeh: z.string().optional(),
          // vlastní náhledový obrázek jen pro toto vydání (soubor v public/novinky/), jinak ilustrace podle ikony,
          // nebo public/novinky/{id}.webp, když je (viz src/components/NahledNovinky.astro)
          obrazek: z.string().optional(),
          obrazekPopis: z.string().optional(),
          // malý graf nad textem: cara (vývoj), sloupce (období), zeme (srovnání zemí EU)
          graf: z
            .object({
              typ: z.enum(['cara', 'sloupce', 'zeme']),
              popis: z.string(),
              jednotka: z.string(),
              desetinna: z.number().int().min(0).max(3).default(1),
              znamenko: z.boolean().optional(),
              rady: z.array(z.object({ nazev: z.string(), body: z.array(z.tuple([z.string(), z.number()])) })).optional(),
              body: z.array(z.tuple([z.string(), z.number()])).optional(),
              zeme: z.array(z.tuple([z.string(), z.string(), z.number()])).optional(),
              zvyraznit: z.string().optional(),
              reference: z.object({ hodnota: z.number(), popis: z.string() }).optional(),
            })
            .optional(),
          // poznámka pro kontrolu v návrhu, na webu se neukazuje
          zkontroluj: z.string().optional(),
        })
      )
      .min(1),
  }),
});

export const collections = { grafy, novinky };
