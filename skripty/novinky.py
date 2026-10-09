#!/usr/bin/env python3
"""Novinky z dat: jednou měsíčně stáhne čerstvá čísla z ČSÚ a Eurostatu, vybere to nejzajímavější
a připraví vydání do src/content/novinky/RRRR-MM.md. Spouští ho GitHub Action (.github/workflows/novinky.yml),
která výsledek pošle jako návrh ke schválení (pull request). Nic se nezveřejní bez tvého Merge.

Ručně ze složky webu:

    python3 skripty/novinky.py

Věty se skládají ze šablon přímo z čísel, nic se nedomýšlí. Každá položka má i data pro malý graf
(pole graf), štítek a změnu pro pás s čísly na úvodní stránce. Položky, které je potřeba ověřit,
mají v návrhu poznámku „zkontroluj“. Používá jen standardní knihovnu Pythonu.
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
DNES = date.today()
VYDANI = f'{DNES.year}-{DNES.month:02d}'

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
        'id': 'nezamestnanost', 'obdobi': t, 'ikona': 'kufrik', 'stitek': 'Nezaměstnanost',
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
        'id': 'hdp', 'obdobi': t, 'ikona': 'trend', 'stitek': 'HDP',
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


UKAZATELE = (inflace, narozeni, pohonne_hmoty, turiste, nezamestnanost, hdp, mzdy, maloobchod, prumysl)


# ---------- vydání ----------

def uz_vyslo() -> set:
    """Dvojice (id, období), které už vyšly v dřívějších vydáních, ať se neopakují."""
    hotovo = set()
    for f in SLOZKA.glob('*.md'):
        if f.stem == VYDANI:
            continue
        for m in re.finditer(r'- id: "([^"]+)"\n\s+obdobi: "([^"]+)"', f.read_text(encoding='utf-8')):
            hotovo.add((m.group(1), m.group(2)))
    return hotovo


def yaml_text(s: str) -> str:
    return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'


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
    radky = ['---', f'titul: "Novinky z dat: {MESIC[DNES.month - 1]} {DNES.year}"', f'datum: {DNES.isoformat()}', 'polozky:']
    for p in nove:
        radky.append(f'  - id: "{p["id"]}"')
        radky.append(f'    obdobi: "{p["obdobi"]}"')
        for k in ('nadpis', 'cislo', 'popisCisla', 'stitek', 'zmena', 'smer', 'ikona', 'text', 'zdroj', 'sada', 'url', 'zkontroluj'):
            if p.get(k):
                radky.append(f'    {k}: {yaml_text(p[k])}')
        if p.get('graf'):
            # JSON je platný YAML, graf tak zůstane na jednom řádku
            radky.append(f'    graf: {json.dumps(p["graf"], ensure_ascii=False, separators=(", ", ": "))}')
    radky += ['---', '', 'Co nového ukázala data, která Český statistický úřad a Eurostat zveřejnili za poslední měsíc.', '']
    (SLOZKA / f'{VYDANI}.md').write_text('\n'.join(radky), encoding='utf-8')
    print(f'Uloženo src/content/novinky/{VYDANI}.md ({len(nove)} položek)')

    # Popis návrhu pro pull request
    popis = [f'## Novinky z dat: {MESIC[DNES.month - 1]} {DNES.year}', '',
             'Automaticky připravený návrh. Projdi čísla, případně uprav text v souboru '
             f'`src/content/novinky/{VYDANI}.md` (záložka Files changed → tři tečky → Edit file) a klikni **Merge**. Pak se novinky objeví na webu.',
             'Položku smažeš tak, že odstraníš celý její blok od `- id:` po řádek `graf:` včetně.', '']
    for p in nove:
        popis.append(f'- **{p["nadpis"]}** ({p["cislo"]}): {p["text"]} [{p["sada"]}]({p["url"]})')
        if p.get('zkontroluj'):
            popis.append(f'  - ⚠️ Zkontroluj: {p["zkontroluj"]}')
    cil = os.environ.get('NAVRH_POPIS')
    if cil:
        Path(cil).write_text('\n'.join(popis) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
