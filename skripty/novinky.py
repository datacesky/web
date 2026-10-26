#!/usr/bin/env python3
"""Novinky z dat: jednou měsíčně stáhne čerstvá čísla z ČSÚ, Eurostatu a Světové banky, vybere to nejzajímavější
a připraví vydání do src/content/novinky/RRRR-MM.md. Spouští ho GitHub Action (.github/workflows/novinky.yml),
která výsledek pošle jako návrh ke schválení (pull request). Nic se nezveřejní bez tvého Merge.

Ručně ze složky webu:

    python3 skripty/novinky.py

Věty se skládají ze šablon přímo z čísel, nic se nedomýšlí. Každá položka má i data pro malý graf
(pole graf), štítek a změnu na kartě a oblast (cesko, evropa, svet) pro filtr na stránce novinek.
Hlavní novinka vydání je položka s nejvyšším skóre (řádek hlavni: v hlavičce souboru, jde přepsat).
Položky, které je potřeba ověřit, mají v návrhu poznámku „zkontroluj“. Používá jen standardní knihovnu Pythonu.

Zveřejněná vydání se nikdy nepřepisují: když už vydání za tento měsíc vyšlo, další spuštění
připraví nové vydání RRRR-MM-DD jen s tím, co od té doby přibylo.
"""
import csv
import io
import json
import os
import re
import statistics
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

KOREN = Path(__file__).resolve().parent.parent
SLOZKA = KOREN / 'src' / 'content' / 'novinky'
SVET = KOREN / 'src' / 'data' / 'svet.json'
DNES = date.fromisoformat(os.environ['NOVINKY_DNES']) if os.environ.get('NOVINKY_DNES') else date.today()
MESICNI = f'{DNES.year}-{DNES.month:02d}'

MESIC = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec']
V_MESICI = ['v lednu', 'v únoru', 'v březnu', 'v dubnu', 'v květnu', 'v červnu', 'v červenci', 'v srpnu', 'v září', 'v říjnu', 'v listopadu', 'v prosinci']
ZA_MESIC = ['za leden', 'za únor', 'za březen', 'za duben', 'za květen', 'za červen', 'za červenec', 'za srpen', 'za září', 'za říjen', 'za listopad', 'za prosinec']

EU27 = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES', 'FI', 'FR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK']
ZEME_EU = {
    'AT': 'Rakousko', 'BE': 'Belgie', 'BG': 'Bulharsko', 'CY': 'Kypr', 'CZ': 'Česko', 'DE': 'Německo', 'DK': 'Dánsko',
    'EE': 'Estonsko', 'EL': 'Řecko', 'ES': 'Španělsko', 'FI': 'Finsko', 'FR': 'Francie', 'HR': 'Chorvatsko', 'HU': 'Maďarsko',
    'IE': 'Irsko', 'IT': 'Itálie', 'LT': 'Litva', 'LU': 'Lucembursko', 'LV': 'Lotyšsko', 'MT': 'Malta', 'NL': 'Nizozemsko',
    'PL': 'Polsko', 'PT': 'Portugalsko', 'RO': 'Rumunsko', 'SE': 'Švédsko', 'SI': 'Slovinsko', 'SK': 'Slovensko',
}


def cislo(v: float, d: int = 1) -> str:
    s = f'{v:,.{d}f}'.replace(',', ' ').replace('.', ',')
    return s.replace('-', '−')


def se_znamenkem(v: float, d: int = 1) -> str:
    return ('+' if v > 0 else '') + cislo(v, d)


def smer(v: float) -> str:
    return 'nahoru' if v > 0 else 'dolu' if v < 0 else 'stejne'


def mesic_text(obdobi: str, predlozka: bool = False, rok: bool = True) -> str:
    r, m = obdobi.split('-')
    return f'{(V_MESICI if predlozka else MESIC)[int(m) - 1]}{f" {r}" if rok else ""}'


def predchozi(obdobi: str, aktualni: str) -> str:
    """„v červenci“ ve stejném roce, „v prosinci 2025“ přes přelom roku"""
    return mesic_text(obdobi, True, rok=obdobi[:4] != aktualni[:4])


def ctvrtleti_text(q: str, pad: str = '6') -> str:
    """2026-Q2 → „ve 2. čtvrtletí 2026“ (pad 6) nebo „2. čtvrtletí 2026“ (pad 1)"""
    r, c = q.split('-Q')
    t = f'{c}. čtvrtletí {r}'
    return (('v ' if c == '1' else 've ') + t) if pad == '6' else t


def stahni(url: str) -> bytes:
    req = urllib.request.Request(url, headers={'User-Agent': 'datacesky.cz (data.cesky@gmail.com)'})
    with urllib.request.urlopen(req, timeout=240) as r:
        return r.read()


def csu(sada: str) -> list[dict]:
    return list(csv.DictReader(io.StringIO(stahni(f'https://data.csu.gov.cz/opendata/sady/{sada}/distribuce/csv').decode('utf-8-sig'))))


def csu_url(sada: str) -> str:
    return f'https://data.csu.gov.cz/opendata/sady/{sada}'


def eurostat(sada: str, parametry: dict) -> dict:
    """Vrátí {(geo, čas): hodnota}. Ostatní dimenze musí mít v dotazu jednu hodnotu."""
    q = urllib.parse.urlencode(parametry, doseq=True)
    d = json.loads(stahni(f'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/{sada}?{q}'))
    dims, size = d['id'], d['size']
    idx = {k: d['dimension'][k]['category']['index'] for k in dims}
    out = {}
    for g, gi in idx['geo'].items():
        for t, ti in idx['time'].items():
            n = 0
            for k, s in zip(dims, size):
                n = n * s + ({'geo': gi, 'time': ti}.get(k, 0))
            v = d['value'].get(str(n))
            if v is not None:
                out[(g, t)] = v
    return out


def z_skore(zmena: float, historie: list[float]) -> float:
    """Jak neobvyklá je změna proti běžným změnám v minulosti (větší = zajímavější)."""
    h = [abs(x) for x in historie if x == x]
    if len(h) < 6:
        return 1.0
    typicka = statistics.median(h) or 1e-9
    return abs(zmena) / typicka


def body(rada: dict, klice: list, d: int = 2) -> list:
    return [[k, round(rada[k], d)] for k in klice if k in rada]


# ---------- jednotlivé ukazatele ----------

def inflace() -> list[dict]:
    r = [x for x in csu('CEN0101H') if x['Ukazatel'] == 'Přírůstek indexu spotřebitelských cen ke stejnému měsíci předchozího roku' and len(x['CASRMX']) == 7]
    rada = {x['CASRMX']: float(x['Hodnota']) for x in r}
    obd = sorted(rada)
    t, p = obd[-1], obd[-2]
    zmeny = [rada[b] - rada[a] for a, b in zip(obd[-61:-1], obd[-60:])]
    text = f'Ceny byly {mesic_text(t, True)} meziročně o {cislo(rada[t])} % vyšší. {predchozi(p, t).capitalize()} to bylo {cislo(rada[p])} %.'
    # Evropsky srovnatelná inflace (HICP) z Eurostatu
    try:
        e = eurostat('prc_hicp_minr', {'geo': ['CZ', 'EU27_2020'], 'coicop18': 'TOTAL', 'unit': 'RCH_A', 'lastTimePeriod': 3})
        spolecne = sorted({t2 for (g, t2) in e if g == 'CZ'} & {t2 for (g, t2) in e if g == 'EU27_2020'})
        if spolecne:
            s = spolecne[-1]
            text += f' Podle evropsky srovnatelné metodiky (HICP) byla inflace {mesic_text(s, True, rok=s[:4] != t[:4])} v Česku {cislo(e[("CZ", s)])} % a v průměru EU {cislo(e[("EU27_2020", s)])} %.'
    except Exception as ex:  # srovnání s EU je jen doplněk
        print('  HICP z Eurostatu se nepodařilo načíst:', ex, file=sys.stderr)
    return [{
        'id': 'inflace', 'obdobi': t, 'ikona': 'cenovka', 'stitek': 'Inflace',
        'nadpis': f'Inflace {mesic_text(t, True)}', 'cislo': f'{cislo(rada[t])} %', 'text': text,
        'zmena': f'{se_znamenkem(rada[t] - rada[p])} p. b.', 'smer': smer(rada[t] - rada[p]),
        'zdroj': 'ČSÚ, Eurostat', 'sada': 'CEN0101H, prc_hicp_minr', 'url': csu_url('CEN0101H'),
        'graf': {
            'typ': 'cara', 'jednotka': '%', 'desetinna': 1,
            'popis': 'Meziroční inflace v Česku za poslední dva roky',
            'rady': [{'nazev': 'Česko', 'body': body(rada, obd[-25:])}],
            'reference': {'hodnota': 2, 'popis': 'cíl ČNB'},
        },
        'skore': z_skore(rada[t] - rada[p], zmeny) + 2.5,
    }]


def pohonne_hmoty() -> list[dict]:
    r = [x for x in csu('CENPHMT') if x['Ukazatel'].startswith('Průměrná cena')]
    rady = {}
    for x in r:
        rady.setdefault(x['Druh PHM'], {})[x['CASTPHM']] = float(x['Hodnota'])
    benzin = rady['Benzin automobilový bezolovnatý Natural 95 oktanu']
    nafta = rady['Motorová nafta']
    t = max(nafta)
    rok, tyden = t.split('-W')
    pred_rokem = f'{int(rok) - 1}-W{tyden}'
    casti = []
    rekord = ''
    for nazev, rada in (('nafta', nafta), ('benzín', benzin)):
        if pred_rokem in rada:
            p = (rada[t] / rada[pred_rokem] - 1) * 100
            casti.append(f'{nazev} {cislo(rada[t], 2)} Kč, před rokem {cislo(rada[pred_rokem], 2)} Kč ({se_znamenkem(p, 0)} %)')
    # od kdy je nafta nejdražší
    drazsi = [k for k, v in nafta.items() if k < t and v >= nafta[t]]
    if not drazsi:
        rekord = f' Nafta je nejdražší od začátku týdenní řady v roce {min(nafta)[:4]}.'
    else:
        posledni = max(drazsi)
        if posledni < f'{int(rok) - 1}':
            rekord = f' Nafta je nejdražší od {int(posledni.split("-W")[1])}. týdne {posledni[:4]}.'
    obd = sorted(nafta)
    zmeny = [(nafta[b] / nafta[a] - 1) * 100 for a, b in zip(obd[-160:-52], obd[-108:])]
    p_nafta = (nafta[t] / nafta[pred_rokem] - 1) * 100 if pred_rokem in nafta else 0
    od = obd.index(pred_rokem) if pred_rokem in obd else max(0, len(obd) - 53)
    return [{
        'id': 'pohonne-hmoty', 'obdobi': t, 'ikona': 'pumpa', 'stitek': 'Nafta',
        'nadpis': f'Ceny pohonných hmot, {int(tyden)}. týden {rok}', 'cislo': f'{cislo(nafta[t], 2)} Kč/l',
        'popisCisla': 'nafta',
        'text': 'Průměrné ceny za litr: ' + '; '.join(casti) + '.' + rekord,
        'zmena': f'{se_znamenkem(p_nafta, 0)} % za rok', 'smer': smer(p_nafta),
        'zdroj': 'ČSÚ', 'sada': 'CENPHMT', 'url': csu_url('CENPHMT'),
        'graf': {
            'typ': 'cara', 'jednotka': 'Kč/l', 'desetinna': 2,
            'popis': 'Průměrná cena za litr, týden po týdnu za poslední rok',
            'rady': [
                {'nazev': 'Nafta', 'body': body(nafta, obd[od:])},
                {'nazev': 'Benzín', 'body': body(benzin, obd[od:])},
            ],
        },
        'skore': z_skore(p_nafta, zmeny) + 0.5,
    }]


def nezamestnanost() -> list[dict]:
    e = eurostat('une_rt_m', {'geo': EU27 + ['EU27_2020'], 's_adj': 'SA', 'age': 'TOTAL', 'sex': 'T', 'unit': 'PC_ACT', 'lastTimePeriod': 18})
    obd = sorted({t for (g, t) in e if g == 'CZ'} & {t for (g, t) in e if g == 'EU27_2020'})
    t, p = obd[-1], obd[-2]
    rok_zpet = f'{int(t[:4]) - 1}{t[4:]}'
    cz, eu = e[('CZ', t)], e[('EU27_2020', t)]
    text = f'Nezaměstnaných bylo {mesic_text(t, True)} {cislo(cz)} % lidí v pracovní síle, {predchozi(p, t)} {cislo(e[("CZ", p)])} %.'
    if ('CZ', rok_zpet) in e:
        text += f' Před rokem {cislo(e[("CZ", rok_zpet)])} %.'
    zeme = {g: e[(g, t)] for g in EU27 if (g, t) in e}
    nizsi = sum(1 for v in zeme.values() if v < cz)
    stejne = sum(1 for g, v in zeme.items() if v == cz and g != 'CZ')
    if len(zeme) >= 20:
        kolik = 'ze všech 27 zemí EU' if len(zeme) == 27 else f'z {len(zeme)} zemí EU, které už data zveřejnily'
        if nizsi == 0 and stejne == 0:
            text += f' Česko má nejnižší nezaměstnanost {kolik}.'
        elif nizsi == 0:
            text += f' Česko má spolu s {"další zemí" if stejne == 1 else f"{stejne} dalšími zeměmi"} nejnižší nezaměstnanost {kolik}.'
        elif nizsi <= 5:
            text += f' Nižší nezaměstnanost než Česko {"má" if nizsi == 1 else "mají"} jen {nizsi} {"země" if nizsi < 5 else "zemí"} {kolik}.'
    text += f' Průměr EU je {cislo(eu)} %.'
    zmeny = [e[('CZ', b)] - e[('CZ', a)] for a, b in zip(obd[:-1], obd[1:])]
    serazene = sorted(zeme.items(), key=lambda x: (x[1], ZEME_EU[x[0]]))
    return [{
        'id': 'nezamestnanost', 'obdobi': t, 'ikona': 'kufrik', 'stitek': 'Nezaměstnanost', 'oblast': 'evropa',
        'nadpis': f'Nezaměstnanost {mesic_text(t, True)}', 'cislo': f'{cislo(cz)} %',
        'text': text + ' Údaje jsou sezónně očištěné.',
        'zmena': f'{se_znamenkem(cz - e[("CZ", p)])} p. b.', 'smer': smer(cz - e[('CZ', p)]),
        'zdroj': 'Eurostat', 'sada': 'une_rt_m', 'url': 'https://ec.europa.eu/eurostat/databrowser/view/une_rt_m/default/table',
        'graf': {
            'typ': 'zeme', 'jednotka': '%', 'desetinna': 1, 'zvyraznit': 'CZ',
            'popis': f'Nezaměstnanost v zemích EU, {mesic_text(t)}, od nejnižší',
            'zeme': [[g, ZEME_EU[g], round(v, 1)] for g, v in serazene],
            'reference': {'hodnota': round(eu, 1), 'popis': 'průměr EU'},
        },
        'skore': z_skore(cz - e[('CZ', p)], zmeny) + 1.5,
    }]


def mzdy() -> list[dict]:
    r = [x for x in csu('MZDQ1')
         if x['CZNACEMZDY'] == 'A-S' and x['ZJIST'] == '0' and x['Uz0123vm.REGION'] == '' and x['Uz0123vm.KRAJ'] == ''
         and x['ISEKTORMZDH.ISEKTOR2'] == '0' and x['KATPMZD'] == '0' and x['ISEKTORMZDH.ISEKTOR5'] == '']
    prumer = {x['CasQ']: float(x['Hodnota']) for x in r if x['IndicatorType'] == '5958P'}
    rozdil = {x['CasQ']: float(x['Hodnota']) for x in r if x['IndicatorType'] == '5958PROZ'}
    t = max(prumer)
    nazev = next(x['Čtvrtletí'] for x in r if x['CasQ'] == t)
    text = f'{ctvrtleti_text(t).capitalize()} byla průměrná hrubá měsíční mzda {cislo(round(prumer[t]), 0)} Kč.'
    pct = None
    if t in rozdil:
        pct = rozdil[t] / (prumer[t] - rozdil[t]) * 100
        text += f' Proti stejnému čtvrtletí před rokem je o {cislo(round(rozdil[t]), 0)} Kč vyšší ({se_znamenkem(pct)} %), bez započtení inflace. Medián, tedy mzda „typického“ zaměstnance, bývá nižší.'
    obd = sorted(prumer)
    return [{
        'id': 'mzdy', 'obdobi': t, 'ikona': 'penezenka', 'stitek': 'Průměrná mzda',
        'nadpis': f'Průměrná mzda, {nazev}', 'cislo': f'{cislo(round(prumer[t]), 0)} Kč',
        'zmena': f'{se_znamenkem(pct)} % za rok' if pct is not None else '', 'smer': smer(pct or 0),
        'text': text, 'zdroj': 'ČSÚ', 'sada': 'MZDQ1', 'url': csu_url('MZDQ1'),
        'graf': {
            'typ': 'sloupce', 'jednotka': 'Kč', 'desetinna': 0,
            'popis': 'Průměrná hrubá měsíční mzda po čtvrtletích (ve 4. čtvrtletí bývá vyšší kvůli odměnám)',
            'body': body(prumer, obd[-9:], 0),
        },
        'skore': 1.2,
    }]


def hdp() -> list[dict]:
    e = eurostat('namq_10_gdp', {'geo': EU27 + ['EU27_2020'], 'unit': 'CLV_PCH_SM', 's_adj': 'SCA', 'na_item': 'B1GQ', 'lastTimePeriod': 12})
    cz = {t: v for (g, t), v in e.items() if g == 'CZ'}
    eu = {t: v for (g, t), v in e.items() if g == 'EU27_2020'}
    obd = sorted(set(cz) & set(eu))
    t, p = obd[-1], obd[-2]
    text = (f'Česká ekonomika byla {ctvrtleti_text(t)} reálně o {cislo(abs(cz[t]))} % {"větší" if cz[t] >= 0 else "menší"} než před rokem. '
            f'{ctvrtleti_text(p).capitalize()} to bylo {cislo(cz[p])} %. Průměr EU je {cislo(eu[t])} %.')
    zeme = {g: e[(g, t)] for g in EU27 if (g, t) in e}
    if len(zeme) >= 20:
        rychleji = sum(1 for g, v in zeme.items() if v > cz[t])
        text += f' Rychleji rostlo {rychleji} z {len(zeme)} zemí EU, které už data zveřejnily.' if len(zeme) < 27 else f' Rychleji rostlo {rychleji} z 27 zemí EU.'
    text += ' Údaje jsou očištěné o sezónní vlivy a změny cen.'
    zmeny = [cz[b] - cz[a] for a, b in zip(obd[:-1], obd[1:])]
    return [{
        'id': 'hdp', 'obdobi': t, 'ikona': 'trend', 'stitek': 'HDP', 'oblast': 'evropa',
        'nadpis': f'Růst ekonomiky, {ctvrtleti_text(t, "1")}', 'cislo': f'{se_znamenkem(cz[t])} %', 'popisCisla': 'za rok',
        'zmena': f'{se_znamenkem(cz[t] - cz[p])} p. b.', 'smer': smer(cz[t] - cz[p]),
        'text': text, 'zdroj': 'Eurostat', 'sada': 'namq_10_gdp',
        'url': 'https://ec.europa.eu/eurostat/databrowser/view/namq_10_gdp/default/table',
        'graf': {
            'typ': 'cara', 'jednotka': '%', 'desetinna': 1,
            'popis': 'Meziroční reálný růst HDP po čtvrtletích, Česko a průměr EU',
            'rady': [{'nazev': 'Česko', 'body': body(cz, obd)}, {'nazev': 'EU', 'body': body(eu, obd)}],
            'reference': {'hodnota': 0, 'popis': ''},
        },
        'skore': z_skore(cz[t] - cz[p], zmeny) + 1.4,
    }]


def turiste() -> list[dict]:
    r = [x for x in csu('CRU02M') if x['Ukazatel'] == 'Počet hostů' and x['Uz02'] == 'CZ']
    celkem = {x['CasM']: float(x['Hodnota']) for x in r if x['REZIDENCE'] == '0'}
    cizinci = {x['CasM']: float(x['Hodnota']) for x in r if x['REZIDENCE'] == '17'}
    t = max(celkem)
    m = t[5:]
    pred = f'{int(t[:4]) - 1}-{m}'
    stejne = sorted(k for k in celkem if k[5:] == m)
    text = f'{mesic_text(t, True).capitalize()} se v hotelech, penzionech, kempech a dalších hromadných ubytovacích zařízeních ubytovalo {cislo(celkem[t], 0)} hostů'
    zmena = (celkem[t] / celkem[pred] - 1) * 100 if pred in celkem else None
    if zmena is not None:
        text += f', o {cislo(abs(zmena))} % {"víc" if zmena > 0 else "méně"} než před rokem.'
    else:
        text += '.'
    if t in cizinci:
        text += f' Z ciziny přijelo {cislo(cizinci[t], 0)} z nich ({cislo(cizinci[t] / celkem[t] * 100, 0)} %).'
    if all(celkem[k] < celkem[t] for k in stejne if k != t):
        text += f' Je to nejvíc {ZA_MESIC[int(m) - 1]} od začátku řady v roce {stejne[0][:4]}.'
    return [{
        'id': 'turiste', 'obdobi': t, 'ikona': 'kufr', 'stitek': f'Hosté {mesic_text(t, True, rok=False)}',
        'nadpis': f'Turisté {mesic_text(t, True)}', 'cislo': cislo(celkem[t], 0), 'popisCisla': 'hostů',
        'zmena': f'{se_znamenkem(zmena)} % za rok' if zmena is not None else '', 'smer': smer(zmena or 0),
        'text': text, 'zdroj': 'ČSÚ', 'sada': 'CRU02M', 'url': csu_url('CRU02M'),
        'graf': {
            'typ': 'sloupce', 'jednotka': 'hostů', 'desetinna': 0,
            'popis': f'Hosté v hromadných ubytovacích zařízeních vždy {ZA_MESIC[int(m) - 1]}',
            'body': [[k[:4], round(celkem[k])] for k in stejne],
        },
        'skore': 1.6 + (0.6 if 'nejvíc' in text else 0),
    }]


def narozeni() -> list[dict]:
    r = [x for x in csu('OBY01CRQM') if x['Ukazatel'] == 'Živě narození' and re.fullmatch(r'\d{4}-Q\d', x['CASMQX'])]
    q = {x['CASMQX']: float(x['Hodnota']) for x in r}
    t = max(q)
    rok, c = int(t[:4]), int(t[-1])
    # Součet od začátku roku: 1. čtvrtletí, 1. pololetí, tři čtvrtletí, celý rok
    def soucet(y):
        k = [f'{y}-Q{i}' for i in range(1, c + 1)]
        return sum(q[x] for x in k) if all(x in q for x in k) else None
    roky = {y: soucet(y) for y in range(int(min(q)[:4]), rok + 1)}
    roky = {y: v for y, v in roky.items() if v is not None}
    obdobi_text = {1: 'v 1. čtvrtletí', 2: 'v 1. pololetí', 3: 'za první tři čtvrtletí', 4: 'za celý rok'}[c]
    ted, loni = roky[rok], roky.get(rok - 1)
    text = f'{obdobi_text.capitalize()} {rok} se v Česku narodilo {cislo(ted, 0)} dětí'
    zmena = None
    if loni:
        zmena = (ted / loni - 1) * 100
        text += f', o {cislo(abs(ted - loni), 0)} {"méně" if ted < loni else "víc"} než o rok dřív ({se_znamenkem(zmena)} %).'
    else:
        text += '.'
    if all(v > ted for y, v in roky.items() if y != rok):
        text += f' Je to nejméně od začátku řady v roce {min(roky)}.'
    text += f' Údaje za rok {rok} jsou předběžné.'
    od = max(min(roky), rok - 25)
    return [{
        'id': 'narozeni', 'obdobi': t, 'ikona': 'kocarek', 'stitek': 'Narozené děti',
        'nadpis': f'Narozené děti, {obdobi_text.replace("v ", "", 1).replace("za ", "", 1)} {rok}', 'cislo': cislo(ted, 0), 'popisCisla': 'dětí',
        'zmena': f'{se_znamenkem(zmena)} % za rok' if zmena is not None else '', 'smer': smer(zmena or 0),
        'text': text, 'zdroj': 'ČSÚ', 'sada': 'OBY01CRQM', 'url': csu_url('OBY01CRQM'),
        'graf': {
            'typ': 'sloupce', 'jednotka': 'dětí', 'desetinna': 0,
            'popis': f'Živě narození {obdobi_text} v jednotlivých letech',
            'body': [[str(y), round(roky[y])] for y in range(od, rok + 1) if y in roky],
        },
        'skore': 2.0 + (0.5 if 'nejméně' in text else 0),
    }]


def _mesicni_index(rada: dict, t: str, p: str) -> list:
    """Meziroční změny v % (index − 100) za posledních 13 měsíců"""
    obd = sorted(rada)
    return [[k, round(rada[k] - 100, 1)] for k in obd[-13:]]


def prumysl() -> list[dict]:
    r = [x for x in csu('PRU01B') if x['NACEIPP.NACE1'] == 'BCD' and x['NACEIPP.NACE2'] == '' and x['TYPUDAJEZ'] == 'IR'
         and re.fullmatch(r'\d{4}-\d\d', x['CASMKMMQR'])]
    rada = {x['CASMKMMQR']: float(x['Hodnota']) for x in r}
    obd = sorted(rada)
    t, p = obd[-1], obd[-2]
    z, zp = rada[t] - 100, rada[p] - 100
    text = (f'Průmyslová výroba byla {mesic_text(t, True)} meziročně o {cislo(abs(z))} % {"vyšší" if z >= 0 else "nižší"}. '
            f'{predchozi(p, t).capitalize()} {se_znamenkem(zp)} %. Údaje jsou očištěné o vliv počtu pracovních dní.')
    zmeny = [rada[b] - rada[a] for a, b in zip(obd[-61:-1], obd[-60:])]
    return [{
        'id': 'prumysl', 'obdobi': t, 'ikona': 'tovarna', 'stitek': 'Průmysl',
        'nadpis': f'Průmysl {mesic_text(t, True)}', 'cislo': f'{se_znamenkem(z)} %', 'popisCisla': 'za rok',
        'zmena': f'{se_znamenkem(z - zp)} p. b.', 'smer': smer(z - zp),
        'text': text, 'zdroj': 'ČSÚ', 'sada': 'PRU01B', 'url': csu_url('PRU01B'),
        'graf': {
            'typ': 'sloupce', 'jednotka': '%', 'desetinna': 1, 'znamenko': True,
            'popis': 'Meziroční změna průmyslové výroby po měsících',
            'body': _mesicni_index(rada, t, p),
        },
        'skore': z_skore(rada[t] - rada[p], zmeny) * 0.6 + 0.6,
    }]


def maloobchod() -> list[dict]:
    r = [x for x in csu('OBC01') if x['CZNACEOB'] == '47' and x['TYPCENA'] == 'P' and x['OCIST'] == 'P' and x['TYPUDAJVM'] == 'IR' and x['CASRQM.CAS_M']]
    rada = {x['CASRQM.CAS_M']: float(x['Hodnota']) for x in r}
    obd = sorted(rada)
    t, p = obd[-1], obd[-2]
    z, zp = rada[t] - 100, rada[p] - 100
    text = (f'Obchody utržily {mesic_text(t, True)} po odečtení zdražení o {cislo(abs(z))} % {"víc" if z >= 0 else "méně"} než před rokem. '
            f'{predchozi(p, t).capitalize()} {se_znamenkem(zp)} %. Jde o maloobchod bez prodeje aut, očištěný o vliv počtu pracovních dní.')
    zmeny = [rada[b] - rada[a] for a, b in zip(obd[-61:-1], obd[-60:])]
    return [{
        'id': 'maloobchod', 'obdobi': t, 'ikona': 'kosik', 'stitek': 'Maloobchod',
        'nadpis': f'Tržby obchodů {mesic_text(t, True)}', 'cislo': f'{se_znamenkem(z)} %', 'popisCisla': 'za rok',
        'zmena': f'{se_znamenkem(z - zp)} p. b.', 'smer': smer(z - zp),
        'text': text, 'zdroj': 'ČSÚ', 'sada': 'OBC01', 'url': csu_url('OBC01'),
        'graf': {
            'typ': 'sloupce', 'jednotka': '%', 'desetinna': 1, 'znamenko': True,
            'popis': 'Meziroční reálná změna tržeb v maloobchodě po měsících',
            'body': _mesicni_index(rada, t, p),
        },
        'skore': z_skore(rada[t] - rada[p], zmeny) * 0.6 + 0.8,
    }]


# ---------- Evropa (Eurostat) ----------

def zemi(n: int) -> str:
    """5 → „5 zemí“, 3 → „3 země“"""
    return f'{n} {"země" if 1 <= n <= 4 else "zemí"}'


def sloveso(n: int, jedna: str, dve_ctyri: str, pet: str) -> str:
    return jedna if n == 1 else dve_ctyri if 2 <= n <= 4 else pet


def z_ze(n: int) -> str:
    """Předložka před číslovkou: ze 185 (sto…), ze 27? ne: z 27 (dvacet…), ze 46 (čtyřicet…)"""
    s = str(n)
    if n >= 100:
        return 'ze' if s[0] in '1467' else 'z'
    if 10 <= n <= 19:
        return 'ze' if n in (14, 16, 17) else 'z'
    return 'ze' if s[0] in '467' else 'z'


def pololeti_text(s: str) -> str:
    """2026-S1 → „1. pololetí 2026“"""
    r, h = s.split('-S')
    return f'{h}. pololetí {r}'


def eu_obdobi(e: dict, min_zemi: int = 25) -> str:
    """Nejnovější období, za které už má data průměr EU, Česko a aspoň min_zemi zemí EU."""
    for t in sorted({t for (_, t) in e}, reverse=True):
        if ('EU27_2020', t) in e and ('CZ', t) in e and sum(1 for g in EU27 if (g, t) in e) >= min_zemi:
            return t
    raise ValueError('zatím málo zemí s daty')


def eu_zeme(e: dict, t: str) -> dict:
    return {g: e[(g, t)] for g in EU27 if (g, t) in e}


def kolik_zemi_eu(zeme: dict) -> str:
    return 'ze všech 27 zemí EU' if len(zeme) == 27 else f'{z_ze(len(zeme))} {len(zeme)} zemí EU, které už data zveřejnily'


def graf_zemi(zeme: dict, jednotka: str, desetinna: int, popis: str, prumer: float, znamenko: bool = False) -> dict:
    g = {
        'typ': 'zeme', 'jednotka': jednotka, 'desetinna': desetinna, 'zvyraznit': 'CZ', 'popis': popis,
        'zeme': [[k, ZEME_EU[k], round(v, desetinna)] for k, v in sorted(zeme.items(), key=lambda x: (x[1], ZEME_EU[x[0]]))],
        'reference': {'hodnota': round(prumer, desetinna), 'popis': 'průměr EU'},
    }
    if znamenko:
        g['znamenko'] = True
    return g


def inflace_eu() -> list[dict]:
    e = eurostat('prc_hicp_minr', {'geo': EU27 + ['EU27_2020'], 'coicop18': 'TOTAL', 'unit': 'RCH_A', 'lastTimePeriod': 14})
    t = eu_obdobi(e)
    obd = sorted(x for (g, x) in e if g == 'EU27_2020')
    p = obd[obd.index(t) - 1]
    eu, eu_p = e[('EU27_2020', t)], e[('EU27_2020', p)]
    zeme = eu_zeme(e, t)
    serazene = sorted(zeme.items(), key=lambda x: (x[1], ZEME_EU[x[0]]))
    (nn, vn), (nv, vv) = serazene[0], serazene[-1]
    text = (f'Ceny v EU byly {mesic_text(t, True)} meziročně v průměru o {cislo(eu)} % vyšší, {predchozi(p, t)} o {cislo(eu_p)} %. '
            f'Nejvyšší inflaci má {ZEME_EU[nv]} ({cislo(vv)} %), nejnižší {ZEME_EU[nn]} ({cislo(vn)} %).')
    cz = zeme['CZ']
    nizsi = sum(1 for v in zeme.values() if v < cz)
    if nizsi == 0:
        text += f' Česko má s {cislo(cz)} % nejnižší inflaci {kolik_zemi_eu(zeme)}.'
    else:
        text += f' Česko má {cislo(cz)} %, nižší inflaci {sloveso(nizsi, "má", "mají", "má")}{" jen" if nizsi <= 5 else ""} {zemi(nizsi)} EU.'
    text += ' Jde o evropsky srovnatelnou inflaci (HICP), která se počítá trochu jinak než česká.'
    zmeny = [e[('EU27_2020', b)] - e[('EU27_2020', a)] for a, b in zip(obd[:-1], obd[1:])]
    return [{
        'id': 'inflace-eu', 'obdobi': t, 'ikona': 'cenovka', 'stitek': 'Inflace v EU', 'oblast': 'evropa',
        'nadpis': f'Inflace v zemích EU {mesic_text(t, True)}', 'cislo': f'{cislo(eu)} %', 'popisCisla': 'průměr EU',
        'zmena': f'{se_znamenkem(eu - eu_p)} p. b.', 'smer': smer(eu - eu_p),
        'text': text, 'zdroj': 'Eurostat', 'sada': 'prc_hicp_minr',
        'url': 'https://ec.europa.eu/eurostat/databrowser/view/prc_hicp_minr/default/table',
        'graf': graf_zemi(zeme, '%', 1, f'Meziroční inflace v zemích EU, {mesic_text(t)}, od nejnižší', eu),
        'skore': 1.2 + z_skore(eu - eu_p, zmeny) * 0.5,
    }]


def bydleni_eu() -> list[dict]:
    e = eurostat('prc_hpi_q', {'geo': EU27 + ['EU27_2020'], 'purchase': 'TOTAL', 'unit': 'RCH_A', 'lastTimePeriod': 8})
    t = eu_obdobi(e, 22)
    obd = sorted(x for (g, x) in e if g == 'CZ')
    p = obd[obd.index(t) - 1]
    zeme = eu_zeme(e, t)
    cz, cz_p, eu = zeme['CZ'], e[('CZ', p)], e[('EU27_2020', t)]
    serazene = sorted(zeme.items(), key=lambda x: (x[1], ZEME_EU[x[0]]))
    (nn, vn), (nv, vv) = serazene[0], serazene[-1]
    text = (f'Byty a domy byly {ctvrtleti_text(t)} v Česku o {cislo(cz)} % dražší než před rokem. '
            f'V průměru EU zdražily o {cislo(eu)} %.')
    vyssi = sum(1 for v in zeme.values() if v > cz)
    if vyssi == 0:
        text += f' Česko má nejrychlejší růst cen bydlení {kolik_zemi_eu(zeme)}.'
    else:
        text += (f' Rychlejší růst cen než Česko {sloveso(vyssi, "má", "mají", "má")} {zemi(vyssi)} EU, '
                 f'na prvním místě je {ZEME_EU[nv]} ({se_znamenkem(vv)} %).')
    if vn < 0:
        text += f' Největší pokles cen má {ZEME_EU[nn]} ({se_znamenkem(vn)} %).'
    text += ' Index zahrnuje nové i starší byty a domy.'
    zmeny = [e[('CZ', b)] - e[('CZ', a)] for a, b in zip(obd[:-1], obd[1:])]
    return [{
        'id': 'bydleni-eu', 'obdobi': t, 'ikona': 'dum', 'stitek': 'Ceny bydlení', 'oblast': 'evropa',
        'nadpis': f'Ceny bydlení v EU, {ctvrtleti_text(t, "1")}', 'cislo': f'{se_znamenkem(cz)} %', 'popisCisla': 'v Česku za rok',
        'zmena': f'{se_znamenkem(cz - cz_p)} p. b.', 'smer': smer(cz - cz_p),
        'text': text, 'zdroj': 'Eurostat', 'sada': 'prc_hpi_q',
        'url': 'https://ec.europa.eu/eurostat/databrowser/view/prc_hpi_q/default/table',
        'graf': graf_zemi(zeme, '%', 1, f'Meziroční změna cen bytů a domů, {ctvrtleti_text(t, "1")}, od nejnižší', eu, True),
        'skore': 1.6 + (0.5 if vyssi <= 4 else 0) + z_skore(cz - cz_p, zmeny) * 0.2,
    }]


def dluh_eu() -> list[dict]:
    e = eurostat('gov_10q_ggdebt', {'geo': EU27 + ['EU27_2020'], 'unit': 'PC_GDP', 'sector': 'S13', 'na_item': 'GD', 'lastTimePeriod': 8})
    t = eu_obdobi(e)
    obd = sorted(x for (g, x) in e if g == 'CZ')
    p = obd[obd.index(t) - 1]
    zeme = eu_zeme(e, t)
    cz, cz_p, eu = zeme['CZ'], e[('CZ', p)], e[('EU27_2020', t)]
    serazene = sorted(zeme.items(), key=lambda x: (x[1], ZEME_EU[x[0]]))
    (nn, vn), (nv, vv) = serazene[0], serazene[-1]
    nizsi = sum(1 for v in zeme.values() if v < cz)
    text = (f'Dluh veřejných rozpočtů v Česku (stát, kraje, obce a zdravotní pojišťovny) byl na konci {ctvrtleti_text(t, "1")} '
            f'{cislo(cz)} % HDP, o čtvrtletí dřív {cislo(cz_p)} %. Průměr EU je {cislo(eu)} % HDP. ')
    text += (f'Nižší dluh než Česko {sloveso(nizsi, "má", "mají", "má")} {zemi(nizsi)} EU, nejnižší {ZEME_EU[nn]} ({cislo(vn)} %). ' if nizsi
             else f'Česko má nejnižší dluh {kolik_zemi_eu(zeme)}. ')
    text += f'Nejvyšší dluh má {ZEME_EU[nv]} ({cislo(vv)} % HDP). Maastrichtská kritéria pro přijetí eura připouštějí nejvýš 60 % HDP.'
    return [{
        'id': 'dluh-eu', 'obdobi': t, 'ikona': 'banka', 'stitek': 'Veřejný dluh', 'oblast': 'evropa',
        'nadpis': f'Veřejný dluh v EU, {ctvrtleti_text(t, "1")}', 'cislo': f'{cislo(cz)} %', 'popisCisla': 'HDP v Česku',
        'zmena': f'{se_znamenkem(cz - cz_p)} p. b.', 'smer': smer(cz - cz_p),
        'text': text, 'zdroj': 'Eurostat', 'sada': 'gov_10q_ggdebt',
        'url': 'https://ec.europa.eu/eurostat/databrowser/view/gov_10q_ggdebt/default/table',
        'graf': graf_zemi(zeme, '% HDP', 1, f'Veřejný dluh v % HDP, konec {ctvrtleti_text(t, "1")}, od nejnižšího', eu),
        'skore': 1.0 + abs(cz - cz_p) * 0.3,
    }]


def elektrina_eu() -> list[dict]:
    zaklad = {'nrg_cons': 'KWH2500-4999', 'unit': 'KWH', 'tax': 'I_TAX', 'lastTimePeriod': 4}
    e = eurostat('nrg_pc_204', {**zaklad, 'geo': EU27 + ['EU27_2020'], 'currency': 'EUR'})
    k = eurostat('nrg_pc_204', {**zaklad, 'geo': 'CZ', 'currency': 'NAC'})
    t = eu_obdobi(e)
    r, h = t.split('-S')
    loni = f'{int(r) - 1}-S{h}'
    kurz = k[('CZ', t)] / e[('CZ', t)]  # Kč za euro v daném pololetí podle samotných dat
    zeme = {g: v * kurz for g, v in eu_zeme(e, t).items()}
    cz, eu = k[('CZ', t)], e[('EU27_2020', t)] * kurz
    serazene = sorted(zeme.items(), key=lambda x: (x[1], ZEME_EU[x[0]]))
    (nn, vn), (nv, vv) = serazene[0], serazene[-1]
    text = f'Domácnosti v Česku platily v {pololeti_text(t)} za kilowatthodinu elektřiny v průměru {cislo(cz, 2)} Kč včetně daní a poplatků'
    zmena = None
    if ('CZ', loni) in k:
        zmena = (cz / k[('CZ', loni)] - 1) * 100
        text += f', o rok dřív {cislo(k[("CZ", loni)], 2)} Kč ({se_znamenkem(zmena, 0)} %)'
    text += f'. Průměr EU je {cislo(eu, 2)} Kč. '
    drazsi = sum(1 for v in zeme.values() if v > cz)
    text += (f'Dražší elektřinu než Česko {sloveso(drazsi, "má", "mají", "má")} {zemi(drazsi)} EU. ' if drazsi
             else f'Česko má nejdražší elektřinu {kolik_zemi_eu(zeme)}. ')
    text += (f'Nejdražší je {ZEME_EU[nv]} ({cislo(vv, 2)} Kč), nejlevnější {ZEME_EU[nn]} ({cislo(vn, 2)} Kč). '
             f'Jde o domácnosti se spotřebou 2 500 až 5 000 kWh za rok, ceny ostatních zemí jsou přepočtené na koruny kurzem za stejné pololetí.')
    return [{
        'id': 'elektrina-eu', 'obdobi': t, 'ikona': 'blesk', 'stitek': 'Cena elektřiny', 'oblast': 'evropa',
        'nadpis': f'Ceny elektřiny v EU, {pololeti_text(t)}', 'cislo': f'{cislo(cz, 2)} Kč', 'popisCisla': 'za kWh v Česku',
        'zmena': f'{se_znamenkem(zmena, 0)} % za rok' if zmena is not None else '', 'smer': smer(zmena or 0),
        'text': text, 'zdroj': 'Eurostat', 'sada': 'nrg_pc_204',
        'url': 'https://ec.europa.eu/eurostat/databrowser/view/nrg_pc_204/default/table',
        'graf': graf_zemi(zeme, 'Kč/kWh', 2, f'Cena elektřiny pro domácnosti s daněmi, {pololeti_text(t)}, od nejlevnější', eu),
        'skore': 1.4 + (abs(zmena) / 10 if zmena is not None else 0),
    }]


# ---------- Svět (Světová banka) ----------

# Země, se kterými Česko ve světových grafech srovnáváme: sousedé, velké ekonomiky a pár dalších
SROVNANI = ['USA', 'DEU', 'AUT', 'GBR', 'FRA', 'JPN', 'KOR', 'ITA', 'ESP', 'POL', 'SVK', 'HUN', 'TUR', 'CHN', 'MEX', 'BRA', 'IND', 'CZE']


def nazvy_zemi() -> dict:
    """Kód ISO A3 → český název (ze src/data/svet.json, bez souhrnů typu EU)"""
    zeme = json.loads(SVET.read_text(encoding='utf-8'))['zeme']
    return {a3: z[0] for a3, z in zeme.items() if a3 != 'EUZ'}


def svetova_banka(ukazatel: str) -> dict:
    """{(kód A3, rok): hodnota} z World Development Indicators za posledních pár let"""
    url = (f'https://api.worldbank.org/v2/country/all/indicator/{ukazatel}'
           f'?format=json&source=2&per_page=20000&date={DNES.year - 4}:{DNES.year}')
    d = json.loads(stahni(url))
    return {(r['countryiso3code'], r['date']): r['value'] for r in d[1] if r['value'] is not None}


def svet_rok(d: dict, nazvy: dict, min_zemi: int = 150) -> str:
    for t in sorted({t for (_, t) in d}, reverse=True):
        if ('CZE', t) in d and ('WLD', t) in d and sum(1 for a in nazvy if (a, t) in d) >= min_zemi:
            return t
    raise ValueError('zatím málo zemí s daty')


def graf_svet(d: dict, nazvy: dict, t: str, jednotka: str, desetinna: int, popis: str, znamenko: bool = False) -> dict:
    vyber = sorted(((a, nazvy[a], round(d[(a, t)], desetinna)) for a in SROVNANI if (a, t) in d), key=lambda x: (x[2], x[1]))
    g = {'typ': 'zeme', 'jednotka': jednotka, 'desetinna': desetinna, 'zvyraznit': 'CZE', 'popis': popis,
         'zeme': [list(x) for x in vyber], 'reference': {'hodnota': round(d[('WLD', t)], desetinna), 'popis': 'svět'}}
    if znamenko:
        g['znamenko'] = True
    return g


def hdp_na_obyvatele_svet() -> list[dict]:
    nazvy = nazvy_zemi()
    d = svetova_banka('NY.GDP.PCAP.PP.CD')
    t = svet_rok(d, nazvy)
    zeme = {a: d[(a, t)] for a in nazvy if (a, t) in d}
    poradi = sorted(zeme, key=lambda a: -zeme[a])
    misto, n = poradi.index('CZE') + 1, len(poradi)
    p = str(int(t) - 1)
    loni = {a: d[(a, p)] for a in zeme if (a, p) in d}
    text = (f'Česko mělo v roce {t} HDP na obyvatele {cislo(zeme["CZE"], 0)} mezinárodních dolarů. '
            f'Přepočet podle parity kupní síly zohledňuje, že stejné zboží stojí v každé zemi jinak. '
            f'Je to {misto}. místo {z_ze(n)} {n} zemí světa')
    zmena = None
    if 'CZE' in loni and len(loni) >= 150:
        misto_p = sorted(loni, key=lambda a: -loni[a]).index('CZE') + 1
        zmena = misto_p - misto
        text += f', o rok dřív {misto_p}. místo' if zmena else ', stejně jako o rok dřív'
    vys = poradi[0]
    text += (f'. Světový průměr je {cislo(d[("WLD", t)], 0)} dolarů, na prvním místě je {nazvy[vys]} ({cislo(zeme[vys], 0)} dolarů). '
             'Data za poslední rok jsou předběžná a Světová banka je ještě může zpřesnit.')
    return [{
        'id': 'hdp-na-obyvatele-svet', 'obdobi': t, 'ikona': 'svet', 'stitek': 'Bohatství zemí', 'oblast': 'svet',
        'nadpis': f'HDP na obyvatele ve světě, rok {t}', 'cislo': f'{misto}. místo', 'popisCisla': f'{z_ze(n)} {n} zemí',
        'zmena': (f'{"+" if zmena > 0 else "−"}{abs(zmena)} {"místo" if abs(zmena) == 1 else "místa" if abs(zmena) <= 4 else "míst"}' if zmena else 'beze změny') if zmena is not None else '',
        'smer': smer(zmena or 0),
        'text': text, 'zdroj': 'Světová banka', 'sada': 'NY.GDP.PCAP.PP.CD',
        'url': 'https://data.worldbank.org/indicator/NY.GDP.PCAP.PP.CD',
        'graf': graf_svet({k: v / 1000 for k, v in d.items()}, nazvy, t, 'tis. $', 1,
                          f'HDP na obyvatele v paritě kupní síly, rok {t}, vybrané země (tisíce mezinárodních dolarů)'),
        'skore': 1.3 + (abs(zmena) * 0.2 if zmena else 0),
    }]


def rust_hdp_svet() -> list[dict]:
    nazvy = nazvy_zemi()
    d = svetova_banka('NY.GDP.MKTP.KD.ZG')
    t = svet_rok(d, nazvy)
    zeme = {a: d[(a, t)] for a in nazvy if (a, t) in d}
    poradi = sorted(zeme, key=lambda a: -zeme[a])
    n, cz, wld = len(poradi), zeme['CZE'], d[('WLD', t)]
    rychleji = sum(1 for v in zeme.values() if v > cz)
    vys = poradi[0]
    text = f'Světová ekonomika rostla v roce {t} reálně o {cislo(wld)} %, česká o {cislo(cz)} %'
    if ('EUU', t) in d:
        text += f' a EU jako celek o {cislo(d[("EUU", t)])} %'
    text += (f'. Rychleji než Česko {sloveso(rychleji, "rostla", "rostly", "rostlo")} {rychleji} {z_ze(n)} {n} zemí světa, '
             f'na prvním místě je {nazvy[vys]} ({se_znamenkem(zeme[vys])} %). Data za poslední rok jsou předběžná.')
    p = str(int(t) - 1)
    zmena = round(wld - d[('WLD', p)], 1) if ('WLD', p) in d else None
    return [{
        'id': 'rust-hdp-svet', 'obdobi': t, 'ikona': 'trend', 'stitek': 'Růst ekonomik', 'oblast': 'svet',
        'nadpis': f'Růst ekonomik světa, rok {t}', 'cislo': f'{se_znamenkem(wld)} %', 'popisCisla': 'svět',
        'zmena': ('beze změny' if zmena == 0 else f'{se_znamenkem(zmena)} p. b.') if zmena is not None else '', 'smer': smer(zmena or 0),
        'text': text, 'zdroj': 'Světová banka', 'sada': 'NY.GDP.MKTP.KD.ZG',
        'url': 'https://data.worldbank.org/indicator/NY.GDP.MKTP.KD.ZG',
        'graf': graf_svet(d, nazvy, t, '%', 1, f'Reálný růst HDP v roce {t}, vybrané země', True),
        'skore': 1.0,
    }]


UKAZATELE = (inflace, narozeni, pohonne_hmoty, turiste, nezamestnanost, hdp, mzdy, maloobchod, prumysl,
             inflace_eu, bydleni_eu, elektrina_eu, dluh_eu, hdp_na_obyvatele_svet, rust_hdp_svet)


# ---------- vydání ----------

def vydani_id() -> str:
    """RRRR-MM. Už zveřejněné vydání se nikdy nepřepíše: další dostane název RRRR-MM-DD (případně RRRR-MM-DD-2…)."""
    for nazev in [MESICNI, f'{MESICNI}-{DNES.day:02d}'] + [f'{MESICNI}-{DNES.day:02d}-{i}' for i in range(2, 10)]:
        if not (SLOZKA / f'{nazev}.md').exists():
            return nazev
    raise SystemExit('Dnes už vyšlo příliš mnoho vydání.')


VYDANI = vydani_id()


def uz_vyslo() -> set:
    """Dvojice (id, období), které už vyšly v dřívějších vydáních, ať se neopakují."""
    hotovo = set()
    for f in SLOZKA.glob('*.md'):
        if f.stem == VYDANI:
            continue
        for m in re.finditer(r'- id: "([^"]+)"\n\s+obdobi: "([^"]+)"', f.read_text(encoding='utf-8')):
            hotovo.add((m.group(1), m.group(2)))
    return hotovo


def minula_hlavni() -> str | None:
    """id hlavní novinky posledního dřívějšího vydání (bez řádku hlavni: je to první položka)"""
    dalsi = sorted((f for f in SLOZKA.glob('*.md') if f.stem != VYDANI), key=lambda f: f.stem)
    if not dalsi:
        return None
    t = dalsi[-1].read_text(encoding='utf-8')
    m = re.search(r'^hlavni: "([^"]+)"', t, re.M) or re.search(r'- id: "([^"]+)"', t)
    return m.group(1) if m else None


def yaml_text(s: str) -> str:
    return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'


OBLASTI = {'cesko': 'Česko', 'evropa': 'Evropa', 'svet': 'Svět'}


def main() -> None:
    SLOZKA.mkdir(parents=True, exist_ok=True)
    polozky = []
    for f in UKAZATELE:
        try:
            polozky += f()
            print(f'  {f.__name__}: OK')
        except Exception as ex:
            print(f'  {f.__name__}: CHYBA {ex}', file=sys.stderr)
    hotovo = uz_vyslo()
    nove = [p for p in polozky if (p['id'], p['obdobi']) not in hotovo]
    if not nove:
        print('Žádná nová data od minulého vydání.')
        return
    nove.sort(key=lambda p: -p['skore'])
    for p in nove:
        print(f'    {p["skore"]:5.2f}  {p["id"]}')
    # Hlavní novinka: nejzajímavější položka, ale jiný ukazatel než hlavní novinka minulého vydání
    minula = minula_hlavni()
    hlavni = next((p for p in nove if p['id'] != minula), nove[0])
    nove.remove(hlavni)
    nove.insert(0, hlavni)
    druhe = VYDANI != MESICNI
    poradi = 1 + sum(1 for f in SLOZKA.glob(f'{MESICNI}*.md') if f.stem != VYDANI)
    titul = f'{MESIC[DNES.month - 1]} {DNES.year}' + (f', {poradi}. vydání' if druhe else '')
    radky = ['---', f'titul: "Novinky z dat: {titul}"', f'datum: {DNES.isoformat()}',
             f'# hlavní novinka vydání (velká karta nahoře na stránce novinek); jde přepsat na id jiné položky',
             f'hlavni: "{nove[0]["id"]}"', 'polozky:']
    for p in nove:
        radky.append(f'  - id: "{p["id"]}"')
        radky.append(f'    obdobi: "{p["obdobi"]}"')
        p.setdefault('oblast', 'cesko')
        for k in ('nadpis', 'cislo', 'popisCisla', 'stitek', 'zmena', 'smer', 'ikona', 'oblast', 'text', 'zdroj', 'sada', 'url', 'zkontroluj'):
            if p.get(k):
                radky.append(f'    {k}: {yaml_text(p[k])}')
        if p.get('graf'):
            # JSON je platný YAML, graf tak zůstane na jednom řádku
            radky.append(f'    graf: {json.dumps(p["graf"], ensure_ascii=False, separators=(", ", ": "))}')
    radky += ['---', '', 'Co nového ukázala data, která zveřejnil Český statistický úřad, Eurostat a Světová banka.', '']
    (SLOZKA / f'{VYDANI}.md').write_text('\n'.join(radky), encoding='utf-8')
    print(f'Uloženo src/content/novinky/{VYDANI}.md ({len(nove)} položek, hlavní: {nove[0]["id"]})')

    # Pro GitHub Action: název vydání (větev návrhu se jmenuje novinky/<vydání>)
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as out:
            out.write(f'vydani={VYDANI}\n')

    # Popis návrhu pro pull request
    popis = [f'## Novinky z dat: {titul}', '',
             'Automaticky připravený návrh. Projdi čísla, případně uprav text v souboru '
             f'`src/content/novinky/{VYDANI}.md` (záložka Files changed → tři tečky → Edit file) a klikni **Merge**. Pak se novinky objeví na webu.',
             'Položku smažeš tak, že odstraníš celý její blok od `- id:` po řádek `graf:` včetně.',
             f'Hlavní novinka měsíce je **{nove[0]["nadpis"]}**. Jinou vybereš tak, že v řádku `hlavni:` přepíšeš id na id jiné položky.',
             'Delší text jen pro hlavní novinku přidáš řádkem `pribeh: "…"` pod její `text:`, obrázek řádkem `obrazek: "/novinky/nazev.jpg"` (soubor dej do `public/novinky/`).', '']
    for o, nazev in OBLASTI.items():
        cast = [p for p in nove if p['oblast'] == o]
        if not cast:
            continue
        popis.append(f'### {nazev}')
        for p in cast:
            popis.append(f'- **{p["nadpis"]}** ({p["cislo"]}): {p["text"]} [{p["sada"]}]({p["url"]})')
            if p.get('zkontroluj'):
                popis.append(f'  - ⚠️ Zkontroluj: {p["zkontroluj"]}')
        popis.append('')
    cil = os.environ.get('NAVRH_POPIS')
    if cil:
        Path(cil).write_text('\n'.join(popis) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
