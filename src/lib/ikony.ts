// Přátelské ikonky (obrys 24×24, styl Tabler). Používají je novinky, žebříčky a karty grafů.
export const IKONY: Record<string, string> = {
  cenovka: 'M3 6v5.2a2 2 0 0 0 .6 1.4l7.7 7.7a2.4 2.4 0 0 0 3.4 0l5.2-5.2a2.4 2.4 0 0 0 0-3.4L12.2 3.6A2 2 0 0 0 10.8 3H6a3 3 0 0 0-3 3z M7.5 6.5a1 1 0 1 0 0 2a1 1 0 1 0 0-2',
  pumpa: 'M4 20V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14 M3 20h12 M4 11h10 M14 11h1a2 2 0 0 1 2 2v3a1.5 1.5 0 0 0 3 0V9l-3-3 M18 7v1a1 1 0 0 0 1 1h1',
  kufrik: 'M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M3 13a20 20 0 0 0 18 0 M12 12v.01',
  penezenka: 'M17 8V5a1 1 0 0 0-1-1H6a2 2 0 0 0 0 4h12a1 1 0 0 1 1 1v3 M19 16v3a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V6 M20 12v4h-4a2 2 0 0 1 0-4z',
  trend: 'M3 17l6-6 4 4 8-8 M14 7h7v7',
  kufr: 'M6 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z M9 6V4.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5V6 M6 10h12 M6 16h12 M9 20v1 M15 20v1',
  kocarek: 'M3 5h2l1.4 4 M6.4 9H20a6 6 0 0 1-6 6h-2.6a5.4 5.4 0 0 1-5-6z M12 9V4a6 6 0 0 1 6 5 M8 19a2 2 0 1 0 0 .01 M17 19a2 2 0 1 0 0 .01',
  tovarna: 'M3 21h18 M4 21V10l5 3.5V10l5 3.5V10l6 4v7 M4 10V4h3v8.2 M8 17h1 M12 17h1 M16 17h1',
  kosik: 'M2.5 3.5h2.6l2.2 11.2a1.6 1.6 0 0 0 1.6 1.3h8.7a1.6 1.6 0 0 0 1.6-1.2l1.7-6.8H6.2 M9.6 20a1.6 1.6 0 1 0 0 .01 M17.2 20a1.6 1.6 0 1 0 0 .01',
  pohar: 'M8 21h8 M12 17v4 M7 4h10v5a5 5 0 0 1-10 0z M7 6H4.5a2.5 2.5 0 0 0 2.6 4 M17 6h2.5a2.5 2.5 0 0 1-2.6 4',
  graf: 'M4 20h16 M7 16v-5 M12 16V7 M17 16v-8',
  spendlik: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z M12 7.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5',
  hory: 'M3 19l6-10 4 6 2.5-3.5L21 19z M8 12.5l1 1 1.5-1.5',
  svet: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M3.6 9h16.8 M3.6 15h16.8 M11.5 3a17 17 0 0 0 0 18 M12.5 3a17 17 0 0 1 0 18',
  burger: 'M4 15h16a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z M12 4c3.9 0 7 2.2 8 5H4c1-2.8 4.1-5 8-5z M4 12h16',
  stit: 'M12 3a12 12 0 0 0 8.5 3A12 12 0 0 1 12 21 12 12 0 0 1 3.5 6 12 12 0 0 0 12 3 M9 12l2 2 4-4',
  lide: 'M9 7a3 3 0 1 0 0 .01 M3 20v-1a6 6 0 0 1 12 0v1 M16 4.5a3 3 0 0 1 0 5.6 M21 20v-1a6 6 0 0 0-4-5.6',
};

export const ikona = (id?: string) => (id && IKONY[id]) || IKONY.graf;

// Ikona tématu grafu
export const IKONA_TEMATU: Record<string, string> = {
  'Peníze': 'penezenka',
  'Obyvatelstvo': 'kocarek',
  'Česko vs. svět': 'svet',
  'Historie': 'graf',
  'Kultura': 'graf',
  'Sport': 'pohar',
  'Mapy': 'spendlik',
  'Cestování': 'kufr',
};
