// Data mapy supermarketů (public/data/obchody.json, vyrábí skripty/data_obchody.py z OpenStreetMap) pro stránku
// Supermarkety v Česku: mapa i přehled počtů pod ní berou čísla odsud, aby seděla na jednu prodejnu.
import fs from 'node:fs';
import path from 'node:path';

export type Obchody = {
  stav: string;
  zdroj: string;
  retezce: { id: string; nazev: string; pocet: number }[];
  formaty: string[];
  kraje: Record<string, Record<string, number>>;
  body: [number, number, number, number, string, string, string, string][];
};

let nactene: Obchody | null = null;
export function nactiObchody(): Obchody {
  nactene ??= JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'data', 'obchody.json'), 'utf-8')) as Obchody;
  return nactene;
}

// Barvy řetězců: co nejblíž značce, ale navzájem odlišné (Penny i Kaufland jsou červené, Lidl i Albert modré)
export const BARVY_RETEZCU: Record<string, string> = {
  penny: '#D8473B', albert: '#2F7FC1', lidl: '#24408E', billa: '#E3B20F', tesco: '#1E9E91', kaufland: '#8E2A1E', globus: '#F08829',
};
// V tmavém režimu jsou Lidl a Kaufland na tmavém podkladu málo vidět, proto světlejší odstín
export const BARVY_RETEZCU_TMAVE: Record<string, string> = { ...BARVY_RETEZCU, lidl: '#5274D9', kaufland: '#C4513F' };
