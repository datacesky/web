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
