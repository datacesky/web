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

export const collections = { grafy };
