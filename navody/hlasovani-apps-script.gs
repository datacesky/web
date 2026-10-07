/**
 * Hlasování pro datacesky.cz – webová aplikace Google Apps Script.
 *
 * Nastavení (asi 5 minut):
 * 1. Otevři Google Tabulku, do které chodí odpovědi z formuláře (nebo založ novou).
 * 2. Rozšíření → Apps Script. Smaž ukázkový kód a vlož celý tento soubor. Ulož (Ctrl+S).
 * 3. Vpravo nahoře Nasadit → Nové nasazení → ozubené kolo → Webová aplikace.
 *      Popis: hlasovani
 *      Spustit jako: Já
 *      Kdo má přístup: Kdokoli
 *    Klikni Nasadit a povol přístup ke svému účtu (Google ukáže varování „neověřená aplikace“,
 *    dej Rozšířené → Přejít na projekt, je to tvůj vlastní skript).
 * 4. Zkopíruj „Adresu URL webové aplikace“ (končí /exec) a vlož ji do src/data/hlasovani.ts jako skript.
 * 5. Kontrola: otevři tu adresu v prohlížeči. Musí se ukázat něco jako {"ok":true,"pocty":{...}}.
 *
 * Hlasy se zapisují do listu „Hlasy“ (vytvoří se sám). Do výsledků se započítají
 * i starší hlasy z listu s odpověďmi formuláře, takže nic z dosavadního hlasování se neztratí.
 * Po každé úpravě kódu je potřeba Nasadit → Spravovat nasazení → upravit → Nová verze.
 */

const LIST_HLASU = 'Hlasy';
const MESIC_MS = 30 * 24 * 3600 * 1000;

function doGet() {
  return vystup(Object.assign({ ok: true }, vysledky()));
}

function doPost(e) {
  const p = (e && e.parameter) || {};
  const kod = String(p.kod || '').toUpperCase().trim();
  const volic = String(p.volic || '').slice(0, 64);
  if (!/^[A-Z]{3}$/.test(kod)) return vystup({ ok: false, chyba: 'neplatny-kod' });

  const zamek = LockService.getScriptLock();
  zamek.waitLock(10000);
  try {
    const list = listHlasu();
    if (volic) {
      const data = list.getDataRange().getValues();
      const hranice = Date.now() - MESIC_MS;
      for (let i = data.length - 1; i >= 1; i--) {
        if (data[i][2] === volic && new Date(data[i][0]).getTime() > hranice) {
          return vystup(Object.assign({ ok: false, chyba: 'uz-hlasoval' }, vysledky()));
        }
      }
    }
    list.appendRow([new Date(), kod, volic]);
  } finally {
    zamek.releaseLock();
  }
  return vystup(Object.assign({ ok: true }, vysledky()));
}

function vysledky() {
  const pocty = {};
  const pricti = (hodnota) => {
    const k = String(hodnota || '').toUpperCase().trim();
    if (/^[A-Z]{3}$/.test(k)) pocty[k] = (pocty[k] || 0) + 1;
  };
  listHlasu().getDataRange().getValues().slice(1).forEach((r) => pricti(r[1]));
  // starší hlasy z Google Formuláře (list „Odpovědi formuláře 1“ / „Form Responses 1“), sloupec B
  SpreadsheetApp.getActiveSpreadsheet().getSheets().forEach((s) => {
    if (/^(Odpovědi formuláře|Form Responses)/i.test(s.getName())) {
      s.getDataRange().getValues().slice(1).forEach((r) => pricti(r[1]));
    }
  });
  let celkem = 0;
  Object.keys(pocty).forEach((k) => (celkem += pocty[k]));
  return { pocty: pocty, celkem: celkem };
}

function listHlasu() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let list = ss.getSheetByName(LIST_HLASU);
  if (!list) {
    list = ss.insertSheet(LIST_HLASU);
    list.appendRow(['čas', 'stát', 'prohlížeč']);
  }
  return list;
}

function vystup(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
