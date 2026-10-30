// Ozbrojené konflikty ve světě: vrstva Konflikty na stránce Svět (podle reelu z 5. 10. 2026).
//
// Jak aktualizovat (jednou za čas, třeba když vyjde nová ročenka UCDP, obvykle v červnu):
//   1. Uprav seznam KONFLIKTY: přidej nový konflikt, smaž skončený, přepiš oběti a úroveň.
//      zeme = kódy států (ISO 3166-1, tři písmena), na jejichž území se bojuje. Stát, který bojuje
//      jen jinde (USA, Velká Británie), se nebarví. Rusko se nebarví celé, i když se bojuje v příhraničí.
//   2. Přepiš STAV (k jakému dni platí) a případně ZDROJE.
//   3. Glóbus, legenda, žebříček i detail státu se přepočítají samy.
//
// uroven: valka = aspoň 1 000 obětí v boji za rok (UCDP), konflikt = 25 až 999 obětí (UCDP),
//         zamrzly = spor pod prahem UCDP (vlastní výběr podle CFR Global Conflict Tracker)
// rok2026: boje v roce 2026, které ještě nejsou v datech UCDP (podle zpravodajství). Stát pak glóbus
//          ukáže jako válku 2026 (pruhy).
// obeti: oběti v boji za rok 2025, nejlepší odhad UCDP

export type Uroven = 'valka' | 'konflikt' | 'zamrzly';
export type Konflikt = {
  nazev: string; zeme: string[]; uroven: Uroven; od: number; strany: string;
  obeti?: number; rok2026?: boolean; pozn?: string;
};

export const STAV = '1. 10. 2026';
export const REEL = 'https://www.instagram.com/reel/DeHV5h2qLTR/';
export const ZDROJE = [
  { nazev: 'UCDP, Uppsala Conflict Data Program (ročenka za rok 2025)', url: 'https://ucdp.uu.se/' },
  { nazev: 'CFR Global Conflict Tracker (zamrzlé konflikty)', url: 'https://www.cfr.org/global-conflict-tracker' },
];

export const KONFLIKTY: Konflikt[] = [
  // --- války (UCDP 2025)
  { nazev: 'Rusko–Ukrajina', zeme: ['UKR'], uroven: 'valka', od: 2022, strany: 'Rusko (+ vojáci KLDR) × Ukrajina', obeti: 94741, pozn: 'Nejsmrtelnější konflikt světa třetí rok po sobě. Boje i v ruském příhraničí.' },
  { nazev: 'Izrael–Gaza', zeme: ['PSE', 'ISR'], uroven: 'valka', od: 2023, strany: 'Izrael × Hamás, PIJ', obeti: 14434, pozn: 'Formální příměří od 10. 10. 2025, údery pokračují.' },
  { nazev: 'Súdán: občanská válka', zeme: ['SDN'], uroven: 'valka', od: 2023, strany: 'armáda SAF × RSF', obeti: 12269, pozn: 'Navíc desítky tisíc civilních obětí po pádu El Fašíru.' },
  { nazev: 'DR Kongo: M23', zeme: ['COD'], uroven: 'valka', od: 2021, strany: 'vláda × AFC/M23 (+ Rwanda)', obeti: 4428, pozn: 'Horní odhad UCDP je 21 297 obětí.' },
  { nazev: 'Etiopie: Amhara', zeme: ['ETH'], uroven: 'valka', od: 2023, strany: 'vláda × Fano', obeti: 3835 },
  { nazev: 'Somálsko: aš-Šabáb', zeme: ['SOM'], uroven: 'valka', od: 2006, strany: 'vláda (+ mise AU, USA) × aš-Šabáb', obeti: 2989 },
  { nazev: 'Burkina Faso: JNIM', zeme: ['BFA'], uroven: 'valka', od: 2018, strany: 'vláda × JNIM', obeti: 2939 },
  { nazev: 'Pákistán: TTP', zeme: ['PAK'], uroven: 'valka', od: 2007, strany: 'vláda × TTP', obeti: 2511 },
  { nazev: 'Nigérie: Islámský stát', zeme: ['NGA'], uroven: 'valka', od: 2015, strany: 'vláda × ISWAP', obeti: 1662 },
  { nazev: 'Myanmar: občanská válka', zeme: ['MMR'], uroven: 'valka', od: 2021, strany: 'junta × NUG', obeti: 1353 },
  { nazev: 'Írán–Izrael', zeme: ['IRN', 'ISR'], uroven: 'valka', od: 2018, strany: 'Izrael (+ USA) × Írán', obeti: 1222, pozn: 'V roce 2025 dvanáctidenní válka.' },
  { nazev: 'Haiti: gangy', zeme: ['HTI'], uroven: 'valka', od: 2024, strany: 'vláda × gangy Viv Ansanm', obeti: 1211, pozn: 'První válka v Americe od roku 2005.' },
  { nazev: 'Mali: JNIM', zeme: ['MLI'], uroven: 'valka', od: 2012, strany: 'vláda (+ Rusko) × JNIM', obeti: 1086 },

  // --- ozbrojené konflikty (UCDP 2025)
  { nazev: 'Írán: Balúčistán', zeme: ['IRN'], uroven: 'konflikt', od: 2023, strany: 'vláda × Džajš al-Adl', obeti: 52 },
  { nazev: 'Irák: Islámský stát', zeme: ['IRQ'], uroven: 'konflikt', od: 2004, strany: 'vláda (+ Francie, VB, USA) × IS', obeti: 77 },
  { nazev: 'Izrael–Sýrie', zeme: ['SYR'], uroven: 'konflikt', od: 2025, strany: 'Izrael × Sýrie', obeti: 35 },
  { nazev: 'Izrael–Jemen', zeme: ['YEM', 'ISR'], uroven: 'konflikt', od: 2025, strany: 'Izrael × Húsíové', obeti: 164 },
  { nazev: 'Izrael–Hizballáh', zeme: ['LBN'], uroven: 'konflikt', od: 2023, strany: 'Izrael × Hizballáh', obeti: 337 },
  { nazev: 'Sýrie: Asadovi loajalisté', zeme: ['SYR'], uroven: 'konflikt', od: 2025, strany: 'vláda × Vojenská rada pro osvobození Sýrie', obeti: 500 },
  { nazev: 'Sýrie: Islámský stát', zeme: ['SYR'], uroven: 'konflikt', od: 2013, strany: 'vláda (+ USA) × IS', obeti: 29 },
  { nazev: 'Sýrie: Rojava', zeme: ['SYR'], uroven: 'konflikt', od: 2023, strany: 'vláda (+ Turecko) × SDF', obeti: 171 },
  { nazev: 'Turecko: Kurdistán', zeme: ['TUR'], uroven: 'konflikt', od: 2015, strany: 'vláda × PKK', obeti: 55, pozn: 'PKK v květnu 2025 oznámila rozpuštění.' },
  { nazev: 'Rudé moře', zeme: ['YEM'], uroven: 'konflikt', od: 2024, strany: 'USA, VB a další × Húsíové', obeti: 781 },
  { nazev: 'Jemen: vláda', zeme: ['YEM'], uroven: 'konflikt', od: 2008, strany: 'Húsíové × Prezidentská rada (+ Saúdská Arábie, SAE)', obeti: 444 },
  { nazev: 'Jemen: Jižní Jemen', zeme: ['YEM'], uroven: 'konflikt', od: 2025, strany: 'Húsíové × STC', obeti: 25 },
  { nazev: 'Afghánistán: NRF', zeme: ['AFG'], uroven: 'konflikt', od: 1978, strany: 'Tálibán × NRF', obeti: 25 },
  { nazev: 'Afghánistán: Islámský stát', zeme: ['AFG'], uroven: 'konflikt', od: 2015, strany: 'Tálibán × IS (ISKP)', obeti: 56 },
  { nazev: 'Afghánistán–Pákistán', zeme: ['AFG', 'PAK'], uroven: 'konflikt', od: 2024, strany: 'Pákistán × Afghánistán', obeti: 178 },
  { nazev: 'Kambodža–Thajsko', zeme: ['KHM', 'THA'], uroven: 'konflikt', od: 2025, strany: 'Kambodža × Thajsko', obeti: 252, pozn: 'Spor o hranici, aktivní poprvé od roku 2011.' },
  { nazev: 'Indie–Pákistán', zeme: ['IND', 'PAK'], uroven: 'konflikt', od: 2025, strany: 'Indie × Pákistán', obeti: 67, pozn: 'Střet v květnu 2025.' },
  { nazev: 'Indie: maoisté', zeme: ['IND'], uroven: 'konflikt', od: 1996, strany: 'vláda × CPI-Maoist', obeti: 417 },
  { nazev: 'Indie: Kašmír', zeme: ['IND'], uroven: 'konflikt', od: 1990, strany: 'vláda × kašmírští povstalci', obeti: 93 },
  { nazev: 'Indie: severovýchod', zeme: ['IND'], uroven: 'konflikt', od: 2025, strany: 'vláda × UNLFW', obeti: 27 },
  { nazev: 'Indonésie: Západní Papua', zeme: ['IDN'], uroven: 'konflikt', od: 2018, strany: 'vláda × OPM', obeti: 104 },
  { nazev: 'Myanmar: Arakan', zeme: ['MMR'], uroven: 'konflikt', od: 2022, strany: 'junta × Arakanská armáda', obeti: 286 },
  { nazev: 'Myanmar: Kačjinsko', zeme: ['MMR'], uroven: 'konflikt', od: 2021, strany: 'junta × KIO', obeti: 220 },
  { nazev: 'Myanmar: Karenové', zeme: ['MMR'], uroven: 'konflikt', od: 2021, strany: 'junta × KNU', obeti: 151 },
  { nazev: 'Myanmar: Karenni', zeme: ['MMR'], uroven: 'konflikt', od: 2021, strany: 'junta × KNPP', obeti: 73 },
  { nazev: 'Pákistán: Balúčistán', zeme: ['PAK'], uroven: 'konflikt', od: 2019, strany: 'vláda × BRAS', obeti: 526 },
  { nazev: 'Pákistán: Islámský stát', zeme: ['PAK'], uroven: 'konflikt', od: 2025, strany: 'vláda × IS', obeti: 54 },
  { nazev: 'Filipíny: komunisté', zeme: ['PHL'], uroven: 'konflikt', od: 1999, strany: 'vláda × CPP (NPA)', obeti: 141 },
  { nazev: 'Thajsko: Patani', zeme: ['THA'], uroven: 'konflikt', od: 2003, strany: 'vláda × patanští povstalci', obeti: 36 },
  { nazev: 'Angola: Cabinda', zeme: ['AGO'], uroven: 'konflikt', od: 2024, strany: 'vláda × FLEC-FAC', obeti: 25 },
  { nazev: 'Benin: JNIM', zeme: ['BEN'], uroven: 'konflikt', od: 2022, strany: 'vláda × JNIM', obeti: 149 },
  { nazev: 'Burkina Faso: Islámský stát', zeme: ['BFA'], uroven: 'konflikt', od: 2019, strany: 'vláda × IS', obeti: 92 },
  { nazev: 'Kamerun: Ambazonie', zeme: ['CMR'], uroven: 'konflikt', od: 2017, strany: 'vláda × ambazonští separatisté', obeti: 133 },
  { nazev: 'Kamerun: Boko Haram', zeme: ['CMR'], uroven: 'konflikt', od: 2022, strany: 'vláda (+ Čad) × Boko Haram', obeti: 45 },
  { nazev: 'Kamerun: Islámský stát', zeme: ['CMR'], uroven: 'konflikt', od: 2025, strany: 'vláda (+ Nigérie) × IS', obeti: 62 },
  { nazev: 'Středoafrická republika', zeme: ['CAF'], uroven: 'konflikt', od: 2018, strany: 'vláda (+ MINUSCA, ruský Africa Corps) × CPC', obeti: 197 },
  { nazev: 'DR Kongo: Islámský stát', zeme: ['COD'], uroven: 'konflikt', od: 2017, strany: 'vláda (+ Uganda) × IS (ADF)', obeti: 36 },
  { nazev: 'Etiopie: Oromie', zeme: ['ETH'], uroven: 'konflikt', od: 2019, strany: 'vláda × OLA', obeti: 477 },
  { nazev: 'Keňa: aš-Šabáb', zeme: ['KEN'], uroven: 'konflikt', od: 2015, strany: 'vláda × aš-Šabáb', obeti: 44 },
  { nazev: 'Mali: Islámský stát', zeme: ['MLI'], uroven: 'konflikt', od: 2017, strany: 'vláda (+ Rusko) × IS', obeti: 189 },
  { nazev: 'Mali: Azavad', zeme: ['MLI'], uroven: 'konflikt', od: 2023, strany: 'vláda (+ Rusko) × FLA (Tuaregové)', obeti: 82 },
  { nazev: 'Mosambik: Islámský stát', zeme: ['MOZ'], uroven: 'konflikt', od: 2019, strany: 'vláda (+ Rwanda) × IS', obeti: 245 },
  { nazev: 'Mosambik: Naparama', zeme: ['MOZ'], uroven: 'konflikt', od: 2025, strany: 'vláda × Naparama', obeti: 51 },
  { nazev: 'Niger: JNIM', zeme: ['NER'], uroven: 'konflikt', od: 2021, strany: 'vláda × JNIM', obeti: 167 },
  { nazev: 'Niger: Islámský stát', zeme: ['NER'], uroven: 'konflikt', od: 2015, strany: 'vláda × IS', obeti: 535 },
  { nazev: 'Nigérie: Boko Haram', zeme: ['NGA'], uroven: 'konflikt', od: 2011, strany: 'vláda (+ Čad, Niger) × Boko Haram', obeti: 195 },
  { nazev: 'Nigérie: Biafra', zeme: ['NGA'], uroven: 'konflikt', od: 2021, strany: 'vláda × IPOB', obeti: 48 },
  { nazev: 'Rwanda: FDLR', zeme: ['RWA'], uroven: 'konflikt', od: 2022, strany: 'vláda × FDLR', obeti: 60, pozn: 'Boje převážně na území DR Konga.' },
  { nazev: 'Somálsko: Islámský stát', zeme: ['SOM'], uroven: 'konflikt', od: 2025, strany: 'vláda (+ USA) × IS', obeti: 106 },
  { nazev: 'Jižní Súdán', zeme: ['SSD'], uroven: 'konflikt', od: 2025, strany: 'vláda × SPLM/A-IO', obeti: 282 },
  { nazev: 'Togo: JNIM', zeme: ['TGO'], uroven: 'konflikt', od: 2022, strany: 'vláda × JNIM', obeti: 69 },
  { nazev: 'Kolumbie', zeme: ['COL'], uroven: 'konflikt', od: 1964, strany: 'vláda × ELN, FARC-EMC', obeti: 298 },

  // --- zamrzlé konflikty (pod prahem UCDP)
  { nazev: 'Korejský poloostrov', zeme: ['PRK', 'KOR'], uroven: 'zamrzly', od: 1950, strany: 'KLDR × Jižní Korea (+ USA)', pozn: 'Příměří z roku 1953, mírová smlouva nikdy nepodepsána.' },
  { nazev: 'Kypr', zeme: ['CYP'], uroven: 'zamrzly', od: 1974, strany: 'Kyperská republika × Severní Kypr (+ Turecko)', pozn: 'Ostrov dělí nárazníková zóna OSN.' },
  { nazev: 'Podněstří', zeme: ['MDA'], uroven: 'zamrzly', od: 1992, strany: 'Moldavsko × separatisté (+ ruská vojska)' },
  { nazev: 'Abcházie a Jižní Osetie', zeme: ['GEO'], uroven: 'zamrzly', od: 1992, strany: 'Gruzie × separatisté (+ Rusko)', pozn: 'Válka v roce 2008.' },
  { nazev: 'Kosovo–Srbsko', zeme: ['XKX'], uroven: 'zamrzly', od: 1998, strany: 'Kosovo × Srbsko', pozn: 'Válka 1998–1999, napětí trvá.' },
  { nazev: 'Indie–Čína: himálajská hranice', zeme: ['IND'], uroven: 'zamrzly', od: 1962, strany: 'Indie × Čína', pozn: 'Spor o hranici v Ladaku, poslední velký střet v údolí Galwán v roce 2020.' },
  { nazev: 'Západní Sahara', zeme: ['ESH'], uroven: 'zamrzly', od: 1975, strany: 'Maroko × Polisario', pozn: 'Příměří z roku 1991 se v roce 2020 zhroutilo.' },

  // --- rok 2026: podle zpravodajství, v datech UCDP zatím nejsou
  { nazev: 'Válka USA a Izraele s Íránem', zeme: ['IRN', 'ISR'], uroven: 'valka', od: 2026, strany: 'USA, Izrael × Írán', rok2026: true, pozn: 'Od 28. 2. 2026, příměří 8. 4., boje obnovené 8. 7.' },
  { nazev: 'Válka v Libanonu', zeme: ['LBN'], uroven: 'valka', od: 2026, strany: 'Izrael × Hizballáh', rok2026: true, pozn: 'Od 2. 3. 2026, formálně dočasné příměří od 16. 4.' },
  { nazev: 'Pákistán–Afghánistán: otevřená válka', zeme: ['AFG', 'PAK'], uroven: 'valka', od: 2026, strany: 'Pákistán × Tálibán', rok2026: true, pozn: 'Pákistán vyhlásil otevřenou válku 27. 2. 2026.' },
  { nazev: 'Jemen: obnovená válka', zeme: ['YEM'], uroven: 'valka', od: 2026, strany: 'Húsíové × vláda (+ Saúdská Arábie)', rok2026: true, pozn: 'Od července 2026, saúdské nálety.' },
];

const PORADI: Record<Uroven, number> = { valka: 0, konflikt: 1, zamrzly: 2 };
export const NAZEV_UROVNE: Record<Uroven, string> = { valka: 'válka', konflikt: 'ozbrojený konflikt', zamrzly: 'zamrzlý konflikt' };

export type StatVKonfliktu = { a3: string; uroven: Uroven; rok2026: boolean; konflikty: Konflikt[]; obeti: number };

// Státy podle nejvážnějšího konfliktu na jejich území
export const STATY: Map<string, StatVKonfliktu> = (() => {
  const m = new Map<string, StatVKonfliktu>();
  for (const k of KONFLIKTY) {
    for (const a3 of k.zeme) {
      const s = m.get(a3) ?? { a3, uroven: k.uroven, rok2026: false, konflikty: [], obeti: 0 };
      if (PORADI[k.uroven] < PORADI[s.uroven]) s.uroven = k.uroven;
      if (k.rok2026) s.rok2026 = true;
      s.konflikty.push(k);
      s.obeti = Math.max(s.obeti, k.obeti ?? 0);
      m.set(a3, s);
    }
  }
  for (const s of m.values()) s.konflikty.sort((a, b) => PORADI[a.uroven] - PORADI[b.uroven] || (b.obeti ?? 0) - (a.obeti ?? 0) || Number(!!b.rok2026) - Number(!!a.rok2026));
  return m;
})();

// Seřazené: války (nejdřív podle největšího počtu obětí), konflikty, zamrzlé
export const STATY_PORADI = [...STATY.values()].sort((a, b) => PORADI[a.uroven] - PORADI[b.uroven] || b.obeti - a.obeti || Number(b.rok2026) - Number(a.rok2026));

export const POCTY = {
  valky: KONFLIKTY.filter((k) => k.uroven === 'valka' && !k.rok2026).length,
  konflikty: KONFLIKTY.filter((k) => k.uroven === 'konflikt').length,
  zamrzle: KONFLIKTY.filter((k) => k.uroven === 'zamrzly').length,
};
