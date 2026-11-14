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
import math
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
    sh = {'cz': rada[t], 'cz_p': rada[p], 'obdobi': t, 'p': p, 'rada': rada}
    # Evropsky srovnatelná inflace (HICP) z Eurostatu
    try:
        e = eurostat('prc_hicp_minr', {'geo': ['CZ', 'EU27_2020'], 'coicop18': 'TOTAL', 'unit': 'RCH_A', 'lastTimePeriod': 3})
        spolecne = sorted({t2 for (g, t2) in e if g == 'CZ'} & {t2 for (g, t2) in e if g == 'EU27_2020'})
        if spolecne:
            s = spolecne[-1]
            text += f' Podle evropsky srovnatelné metodiky (HICP) byla inflace {mesic_text(s, True, rok=s[:4] != t[:4])} v Česku {cislo(e[("CZ", s)])} % a v průměru EU {cislo(e[("EU27_2020", s)])} %.'
            sh.update({'hicp_cz': e[('CZ', s)], 'hicp_eu': e[('EU27_2020', s)], 'hicp_obd': s})
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
        '_s': sh,
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
        '_s': {'nafta': nafta[t], 'nafta_rok': nafta.get(pred_rokem), 'benzin': benzin.get(t), 'benzin_rok': benzin.get(pred_rokem), 'tyden': t},
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
        '_s': {'cz': cz, 'eu': eu, 'cz_rok': e.get(('CZ', rok_zpet)), 'poradi': nizsi + 1, 'n': len(zeme), 'obdobi': t,
               'nejvyssi': [ZEME_EU[serazene[-1][0]], serazene[-1][1]]},
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
        '_s': {'nom': pct, 'obdobi': t, 'prumer': prumer[t], 'rozdil': rozdil.get(t)},
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
        '_s': {'cz': cz[t], 'cz_p': cz[p], 'eu': eu[t], 'obdobi': t, 'p': p},
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
        '_s': {'cz': cz, 'eu': eu, 'obdobi': t, 'vyssi': vyssi, 'n': len(zeme), 'nejvyssi': [ZEME_EU[nv], vv]},
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
        '_s': {'misto': misto, 'n': n, 'rok': t},
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
        '_s': {'wld': wld, 'cz': cz, 'rok': t},
    }]


UKAZATELE = (inflace, narozeni, pohonne_hmoty, turiste, nezamestnanost, hdp, mzdy, maloobchod, prumysl,
             inflace_eu, bydleni_eu, elektrina_eu, dluh_eu, hdp_na_obyvatele_svet, rust_hdp_svet)


# ---------- souhrn měsíce ----------
# Krátké shrnutí lidskou řečí: co se za poslední data změnilo pro lidi (ceny, výplaty, tankování, práce, bydlení,
# ekonomika) a jak je na tom Česko proti Evropě a světu. Na úvodní stránce je titulek a perex, nahoře na stránce
# Novinky celý souhrn se šesti oblastmi. Skládá se ze stejných čísel jako novinky (vždy z nejnovějších dat
# každého ukazatele, i když už dřív vyšla), věty jsou šablony. V návrhu ke schválení jde všechno přepsat.

SLOVY = {1: 'jeden', 2: 'dva', 3: 'tři', 4: 'čtyři', 5: 'pět', 6: 'šest', 7: 'sedm', 8: 'osm', 9: 'devět', 10: 'deset',
         11: 'jedenáct', 12: 'dvanáct', 13: 'třináct', 14: 'čtrnáct', 15: 'patnáct', 16: 'šestnáct', 17: 'sedmnáct',
         18: 'osmnáct', 19: 'devatenáct', 20: 'dvacet'}


def kc(v: float) -> str:
    """Celé koruny, polovina se zaokrouhlí nahoru (2 412,5 → 2 413)"""
    return cislo(math.copysign(math.floor(abs(v) + 0.5), v), 0)


def procent_slovne(v: float) -> str:
    """Zaokrouhlení pro větu lidskou řečí: 4,3 → „4“, 0,8 → „0,8“"""
    return cislo(v, 0) if abs(v) >= 1.5 else cislo(v, 1)


def cnb_vztah(cz: float) -> str:
    if cz < 0:
        return 'ceny dokonce klesají'
    if cz < 1.5:
        return 'pod cílem ČNB'
    if cz <= 2.5:
        return 'blízko cíle ČNB'
    return f'nad cílem ČNB, který je 2 %'


def bod_ceny(s: dict) -> dict:
    cz, cz_p, t = s['cz'], s['cz_p'], s['obdobi']
    r, m = int(t[:4]), int(t[5:])
    letos = r == DNES.year
    kdy_loni = f'loni {V_MESICI[m - 1]}' if letos else f'{V_MESICI[m - 1]} {r - 1}'
    kdy_ted = f'letos {V_MESICI[m - 1]}' if letos else f'{V_MESICI[m - 1]} {r}'
    veta = f'Co {kdy_loni} stálo 1 000 Kč, stálo {kdy_ted} {kc(1000 * (1 + cz / 100))} Kč.'
    text = f'Ceny byly {mesic_text(t, True)} meziročně o {cislo(cz)} % vyšší'
    if round(cz, 1) < round(cz_p, 1):
        text += f', zdražování mírně zpomalilo ({predchozi(s["p"], t)} {cislo(cz_p)} %).'
    elif round(cz, 1) > round(cz_p, 1):
        text += f', zdražování zrychlilo ({predchozi(s["p"], t)} {cislo(cz_p)} %).'
    else:
        text += f', stejně jako {predchozi(s["p"], t)}.'
    if 1.5 <= cz <= 2.5:
        text += ' To je blízko cíle České národní banky, který je 2 %.'
    elif cz > 2.5:
        text += f' Cíl České národní banky (2 %) je tak překročený o {cislo(cz - 2)} procentního bodu.'
    elif cz >= 0:
        text += ' Ceny tak rostou pomaleji, než je cíl České národní banky (2 %).'
    srovnani = None
    if 'hicp_cz' in s:
        hc, he, ho = s['hicp_cz'], s['hicp_eu'], s['hicp_obd']
        kdy = mesic_text(ho, True, rok=ho[:4] != t[:4])
        text += (f' V EU zdražuje {"rychleji" if he > hc else "pomaleji" if he < hc else "stejně"}: {kdy} tam byla inflace v průměru '
                 f'{cislo(he)} %, v Česku podle stejné evropské metodiky {cislo(hc)} %.')
        srovnani = {'popis': f'Inflace podle evropské metodiky (HICP), {mesic_text(ho)}', 'jednotka': '%', 'desetinna': 1,
                    'pruhy': [['Česko', round(hc, 1), 'cz'], ['Průměr EU', round(he, 1), 'eu']]}
    if cz < 0:
        ton, stav = 'neutralni', 'Ceny klesají'
    elif cz < 1.5:
        ton, stav = 'dobre', 'Pod cílem ČNB'
    elif cz <= 2.5:
        ton, stav = 'dobre', 'Blízko cíle ČNB'
    elif cz <= 3.5:
        ton, stav = 'neutralni', 'Mírně nad cílem ČNB'
    else:
        ton, stav = 'spatne', 'Rychlé zdražování'
    if cz <= 2.5:
        klauze = ('ceny', 'rostou jen mírně')
    elif cz <= 3.5:
        klauze = ('ceny', 'rostou rychleji, než chce ČNB')
    else:
        klauze = ('ceny', f'rostou o {cislo(cz)} % ročně')
    return {
        'id': 'ceny', 'tema': 'Ceny', 'ikona': 'cenovka', 'ton': ton, 'stav': stav,
        'cislo': f'{cislo(cz)} %', 'popisCisla': 'za rok', 'veta': veta, 'text': text, 'srovnani': srovnani,
        'zdroj': 'ČSÚ, Eurostat' if srovnani else 'ČSÚ', 'url': csu_url('CEN0101H'), 'novinka': 'inflace',
        '_klauze': klauze, '_kratce': f'Ceny rostou o {cislo(cz)} % za rok, {cnb_vztah(cz)}.',
        '_vyraznost': abs(cz - 2) * 1.2 + (0.5 if abs(cz - cz_p) >= 0.5 else 0),
    }


def bod_vyplaty(s: dict, inflace_s: dict | None) -> dict | None:
    nom, q = s['nom'], s['obdobi']
    if nom is None or not inflace_s:
        return None
    r, c = int(q[:4]), int(q[-1])
    mesice = [f'{r}-{m:02d}' for m in range(3 * c - 2, 3 * c + 1)]
    rada = inflace_s['rada']
    if not all(m in rada for m in mesice):
        return None
    ceny = sum(rada[m] for m in mesice) / 3  # průměr meziroční inflace za čtvrtletí, jako ji ČSÚ používá u reálné mzdy
    real = ((1 + nom / 100) / (1 + ceny / 100) - 1) * 100
    x = procent_slovne(abs(real))
    if real > 0.5:
        veta = f'Výplaty rostou rychleji než ceny. Za průměrnou mzdu si lidé koupí zhruba o {x} % víc než před rokem.'
        kratce = f'Výplaty rostou rychleji než ceny, za průměrnou mzdu si lidé koupí zhruba o {x} % víc než před rokem.'
        ton, stav, klauze = 'dobre', 'Reálně víc peněz', ('výplaty', 'rostou rychleji než ceny')
    elif real < -0.5:
        veta = f'Výplaty nestačí zdražování. Za průměrnou mzdu si lidé koupí zhruba o {x} % méně než před rokem.'
        kratce = f'Výplaty nestačí zdražování, za průměrnou mzdu si lidé koupí zhruba o {x} % méně než před rokem.'
        ton, stav, klauze = 'spatne', 'Reálně méně peněz', ('výplaty', 'nestačí zdražování')
    else:
        veta = 'Výplaty rostou zhruba stejně rychle jako ceny. Za průměrnou mzdu si lidé koupí podobně jako před rokem.'
        kratce = 'Výplaty rostou zhruba stejně rychle jako ceny.'
        ton, stav, klauze = 'neutralni', 'Drží krok s cenami', ('výplaty', 'drží krok s cenami')
    text = f'{ctvrtleti_text(q).capitalize()} byla průměrná hrubá měsíční mzda {kc(s["prumer"])} Kč'
    if s.get('rozdil'):
        text += f', o {kc(s["rozdil"])} Kč víc než o rok dřív ({se_znamenkem(nom)} %)'
    text += (f'. Ceny za stejnou dobu stouply zhruba o {cislo(ceny)} %, reálně tak mzda vzrostla asi o {cislo(real)} %. '
             'Většina lidí bere méně, než je průměr, protože ho zvedají vysoké výdělky.')
    bod = {
        'id': 'vyplaty', 'tema': 'Výplaty', 'ikona': 'penezenka', 'ton': ton, 'stav': stav,
        'cislo': f'{se_znamenkem(real)} %', 'popisCisla': 'reálně za rok', 'veta': veta, 'text': text,
        'srovnani': {'popis': f'Meziroční růst průměrné mzdy a cen, {ctvrtleti_text(q, "1")}', 'jednotka': '%', 'desetinna': 1,
                     'pruhy': [['Mzda', round(nom, 1), 'cz'], ['Ceny', round(ceny, 1), 'jine']]},
        'zdroj': 'ČSÚ', 'url': csu_url('MZDQ1'), 'novinka': 'mzdy',
        '_klauze': klauze, '_kratce': kratce, '_vyraznost': abs(real) / 2.5,
    }
    # otevřená data o mzdách vycházejí později než tisková zpráva ČSÚ (začátkem března, června, září a prosince)
    if (DNES.year - r) * 12 + DNES.month - 3 * c > 5:
        bod['zkontroluj'] = ('Datová sada MZDQ1 končí ' + ctvrtleti_text(q, '1') + '. ČSÚ mohl novější čtvrtletí zveřejnit '
                             'zatím jen v tiskové zprávě: https://csu.gov.cz/statistika/zamestnanci-a-mzdy')
    return bod


def bod_tankovani(s: dict) -> dict | None:
    nafta, loni = s['nafta'], s['nafta_rok']
    if not loni:
        return None
    rok, tyden = s['tyden'].split('-W')
    p = (nafta / loni - 1) * 100
    rozdil = 50 * (nafta - loni)
    veta = f'Plná nádrž 50 litrů nafty stojí {kc(50 * nafta)} Kč, o {kc(abs(rozdil))} Kč {"víc" if rozdil > 0 else "méně"} než před rokem.'
    text = f'Litr nafty stál v {int(tyden)}. týdnu {rok} v průměru {cislo(nafta, 2)} Kč, před rokem {cislo(loni, 2)} Kč ({se_znamenkem(p, 0)} %).'
    if s.get('benzin') and s.get('benzin_rok'):
        pb = (s['benzin'] / s['benzin_rok'] - 1) * 100
        text += f' Benzín Natural 95 stál {cislo(s["benzin"], 2)} Kč, před rokem {cislo(s["benzin_rok"], 2)} Kč ({se_znamenkem(pb, 0)} %).'
    if p >= 15:
        ton, stav = 'spatne', 'Výrazně dráž'
    elif p >= 5:
        ton, stav = 'spatne', 'Dráž než loni'
    elif p <= -15:
        ton, stav = 'dobre', 'Výrazně levněji'
    elif p <= -5:
        ton, stav = 'dobre', 'Levněji než loni'
    else:
        ton, stav = 'neutralni', 'Skoro jako loni'
    if p >= 5:
        klauze = ('nafta', f'je o {cislo(p, 0)} % dražší než loni')
    elif p <= -5:
        klauze = ('nafta', f'je o {cislo(-p, 0)} % levnější než loni')
    else:
        klauze = ('nafta', 'stojí skoro jako loni')
    return {
        'id': 'tankovani', 'tema': 'Tankování', 'ikona': 'pumpa', 'ton': ton, 'stav': stav,
        'cislo': f'{se_znamenkem(p, 0)} %', 'popisCisla': 'nafta za rok', 'veta': veta, 'text': text,
        'srovnani': {'popis': f'Průměrná cena litru nafty, {int(tyden)}. týden', 'jednotka': 'Kč/l', 'desetinna': 2,
                     'pruhy': [[str(int(rok) - 1), round(loni, 2), 'jine'], [rok, round(nafta, 2), 'cz']]},
        'zdroj': 'ČSÚ', 'url': csu_url('CENPHMT'), 'novinka': 'pohonne-hmoty',
        '_klauze': klauze,
        '_kratce': f'Plná nádrž nafty vyjde o {kc(abs(rozdil))} Kč {"dráž" if rozdil > 0 else "levněji"} než před rokem.',
        '_vyraznost': abs(p) / 8,
    }


def bod_prace(s: dict) -> dict:
    cz, eu, t, poradi = s['cz'], s['eu'], s['obdobi'], s['poradi']
    n = max(1, round(cz))
    ne = max(1, round(eu))
    veta = (f'Ze 100 lidí, kteří chtějí pracovat, {"jsou" if 2 <= n <= 4 else "je"} bez práce zhruba {SLOVY.get(n, str(n))}. '
            f'V průměru EU je to {SLOVY.get(ne, str(ne))}.')
    text = f'Nezaměstnanost byla {mesic_text(t, True)} {cislo(cz)} %'
    text += f', před rokem {cislo(s["cz_rok"])} %.' if s.get('cz_rok') is not None else '.'
    if poradi == 1:
        text += ' Je to nejnižší nezaměstnanost ze všech zemí EU.'
    elif poradi <= 5:
        text += f' Nižší {sloveso(poradi - 1, "má", "mají", "má")} jen {zemi(poradi - 1)} EU.'
    text += f' Průměr EU je {cislo(eu)} %'
    if s.get('nejvyssi'):
        text += f', nejvyšší nezaměstnanost má {s["nejvyssi"][0]} ({cislo(s["nejvyssi"][1])} %)'
    text += '. Údaje jsou sezónně očištěné.'
    pruhy = [['Česko', round(cz, 1), 'cz'], ['Průměr EU', round(eu, 1), 'eu']]
    if s.get('nejvyssi'):
        pruhy.append([s['nejvyssi'][0], round(s['nejvyssi'][1], 1), 'jine'])
    if poradi == 1:
        ton, stav, klauze = 'dobre', 'Nejnižší v EU', ('nezaměstnanost', 'je nejnižší v EU')
        kratce = f'Nezaměstnanost je {cislo(cz)} %, nejnižší v celé EU.'
    elif cz < eu:
        ton, stav, klauze = 'dobre', 'Pod průměrem EU', ('práce', 'je dost')
        kratce = f'Nezaměstnanost je {cislo(cz)} %, pod průměrem EU ({cislo(eu)} %).'
    else:
        ton, stav, klauze = 'spatne', 'Nad průměrem EU', ('nezaměstnanost', 'je nad průměrem EU')
        kratce = f'Nezaměstnanost je {cislo(cz)} %, nad průměrem EU ({cislo(eu)} %).'
    return {
        'id': 'prace', 'tema': 'Práce', 'ikona': 'kufrik', 'ton': ton, 'stav': stav,
        'cislo': f'{cislo(cz)} %', 'popisCisla': 'nezaměstnanost', 'veta': veta, 'text': text,
        'srovnani': {'popis': f'Nezaměstnanost, {mesic_text(t)}', 'jednotka': '%', 'desetinna': 1, 'pruhy': pruhy},
        'zdroj': 'Eurostat', 'url': 'https://ec.europa.eu/eurostat/databrowser/view/une_rt_m/default/table', 'novinka': 'nezamestnanost',
        '_klauze': klauze, '_kratce': kratce,
        '_vyraznost': 0.8 + (0.4 if poradi == 1 else 0) + (abs(cz - s['cz_rok']) if s.get('cz_rok') is not None else 0),
    }


def bod_bydleni(s: dict) -> dict:
    cz, eu, t, vyssi = s['cz'], s['eu'], s['obdobi'], s['vyssi']
    nove = 5 * (1 + cz / 100)
    veta = f'Byt, který před rokem stál 5 milionů korun, by teď stál zhruba {cislo(nove, 2)} milionu.'
    text = f'Byty a domy zdražily {ctvrtleti_text(t)} v Česku o {cislo(cz)} % za rok, v průměru EU o {cislo(eu)} %.'
    if vyssi == 0:
        text += ' Rychleji než v Česku nezdražuje bydlení v žádné zemi EU.'
    else:
        text += f' Rychleji zdražuje {zemi(vyssi)} EU'
        text += f', nejvíc {s["nejvyssi"][0]} ({se_znamenkem(s["nejvyssi"][1])} %).' if s.get('nejvyssi') else '.'
    pruhy = [['Česko', round(cz, 1), 'cz'], ['Průměr EU', round(eu, 1), 'eu']]
    if s.get('nejvyssi') and vyssi > 0:
        pruhy.append([s['nejvyssi'][0], round(s['nejvyssi'][1], 1), 'jine'])
    if cz > eu + 1:
        ton, stav, klauze = 'spatne', 'Rychleji než v EU', ('byty', 'zdražují rychleji než v EU')
        text += ' Pro ty, kdo bydlení teprve shánějí, je to horší zpráva.'
    elif cz < eu - 1:
        ton, stav, klauze = 'dobre', 'Pomaleji než v EU', ('byty', 'zdražují pomaleji než v EU')
    else:
        ton, stav, klauze = 'neutralni', 'Podobně jako v EU', ('byty', 'zdražují podobně jako v EU')
    return {
        'id': 'bydleni', 'tema': 'Bydlení', 'ikona': 'dum', 'ton': ton, 'stav': stav,
        'cislo': f'{se_znamenkem(cz)} %', 'popisCisla': 'ceny za rok', 'veta': veta, 'text': text,
        'srovnani': {'popis': f'Meziroční změna cen bytů a domů, {ctvrtleti_text(t, "1")}', 'jednotka': '%', 'desetinna': 1, 'pruhy': pruhy},
        'zdroj': 'Eurostat', 'url': 'https://ec.europa.eu/eurostat/databrowser/view/prc_hpi_q/default/table', 'novinka': 'bydleni-eu',
        '_klauze': klauze, '_kratce': f'Byty a domy zdražují o {cislo(cz)} % za rok, v průměru EU o {cislo(eu)} %.',
        '_vyraznost': abs(cz - eu) / 4,
    }


def bod_ekonomika(s: dict, bohatstvi: dict | None, svet: dict | None) -> dict:
    cz, cz_p, eu, t = s['cz'], s['cz_p'], s['eu'], s['obdobi']
    if abs(cz - eu) <= 0.3:
        srov = f'zhruba stejně jako průměr EU ({cislo(eu)} %)'
    elif cz > eu:
        srov = f'rychleji než průměr EU ({cislo(eu)} %)'
    else:
        srov = f'pomaleji než průměr EU ({cislo(eu)} %)'
    veta = (f'Česká ekonomika roste o {cislo(cz)} % za rok, {srov}.' if cz >= 0
            else f'Česká ekonomika je o {cislo(-cz)} % menší než před rokem. Průměr EU je {cislo(eu)} %.')
    text = (f'{ctvrtleti_text(t).capitalize()} byla česká ekonomika reálně o {cislo(abs(cz))} % {"větší" if cz >= 0 else "menší"} než před rokem, '
            f'{ctvrtleti_text(s["p"])} to bylo {cislo(cz_p)} %.')
    if bohatstvi:
        text += (f' Podle HDP na obyvatele v paritě kupní síly je Česko {bohatstvi["misto"]}. {z_ze(bohatstvi["n"])} {bohatstvi["n"]} zemí světa '
                 f'(Světová banka, rok {bohatstvi["rok"]}).')
    if svet:
        text += f' Celá světová ekonomika rostla v roce {svet["rok"]} o {cislo(svet["wld"])} %, česká o {cislo(svet["cz"])} %.'
    if cz < 0:
        ton, stav, klauze = 'spatne', 'Ekonomika klesá', ('ekonomika', 'klesá')
    elif cz < cz_p - 0.5:
        ton, stav, klauze = 'neutralni', 'Zpomaluje', ('ekonomika', 'zpomaluje')
    elif cz > eu + 0.3:
        ton, stav, klauze = 'dobre', 'Rychleji než EU', ('ekonomika', 'roste rychleji než v EU')
    elif abs(cz - eu) <= 0.3:
        ton, stav, klauze = 'neutralni', 'Roste jako EU', ('ekonomika', 'roste stejně jako v EU')
    else:
        ton, stav, klauze = 'neutralni', 'Pomaleji než EU', ('ekonomika', 'roste pomaleji než v EU')
    zdroj = 'Eurostat' + (', Světová banka' if bohatstvi or svet else '')
    return {
        'id': 'ekonomika', 'tema': 'Ekonomika', 'ikona': 'trend', 'ton': ton, 'stav': stav,
        'cislo': f'{se_znamenkem(cz)} %', 'popisCisla': 'HDP za rok', 'veta': veta, 'text': text,
        'srovnani': {'popis': f'Meziroční reálný růst HDP, {ctvrtleti_text(t, "1")}', 'jednotka': '%', 'desetinna': 1,
                     'pruhy': [['Česko', round(cz, 1), 'cz'], ['Průměr EU', round(eu, 1), 'eu']]},
        'zdroj': zdroj, 'url': 'https://ec.europa.eu/eurostat/databrowser/view/namq_10_gdp/default/table', 'novinka': 'hdp',
        '_klauze': klauze,
        '_kratce': (f'Ekonomika roste o {cislo(cz)} % za rok, {srov.split(" (")[0]}.' if cz >= 0 else f'Ekonomika je o {cislo(-cz)} % menší než před rokem.'),
        '_vyraznost': abs(cz - cz_p) * 0.8 + (1.5 if cz < 0 else 0),
    }


def souhrn(polozky: list[dict]) -> dict | None:
    """Souhrn měsíce z nejnovějších čísel všech ukazatelů (včetně těch, která už vyšla v dřívějších vydáních)."""
    s = {p['id']: p['_s'] for p in polozky if p.get('_s')}
    body = []
    for f, args in ((bod_ceny, ('inflace',)), (bod_vyplaty, ('mzdy', 'inflace')), (bod_tankovani, ('pohonne-hmoty',)),
                    (bod_prace, ('nezamestnanost',)), (bod_bydleni, ('bydleni-eu',)),
                    (bod_ekonomika, ('hdp', 'hdp-na-obyvatele-svet', 'rust-hdp-svet'))):
        if args[0] not in s:
            continue
        try:
            b = f(*[s.get(a) for a in args])
            if b:
                body.append(b)
        except Exception as ex:  # souhrn je doplněk, chyba jedné oblasti nesmí shodit vydání
            print(f'  souhrn {f.__name__}: CHYBA {ex}', file=sys.stderr)
    if len(body) < 3:
        return None
    podle = sorted(body, key=lambda b: -b['_vyraznost'])
    prvni = podle[0]
    # druhá část titulku: nejvýraznější oblast s opačným vyzněním, jinak druhá nejvýraznější
    opak = {'dobre': 'spatne', 'spatne': 'dobre'}.get(prvni['ton'])
    druhy = next((b for b in podle[1:] if b['ton'] == opak), podle[1])
    (p1, z1), (p2, z2) = prvni['_klauze'], druhy['_klauze']
    titulek = f'{p1.capitalize()} {z1}, {p2} ale {z2}' if druhy['ton'] == opak else f'{p1.capitalize()} {z1} a {p2} {z2}'
    perex_body = [prvni, druhy] + [b for b in podle if b not in (prvni, druhy)][:1]
    perex = ' '.join(b['_kratce'] for b in perex_body)
    zkontroluj = [f'{b["tema"]}: {b["zkontroluj"]}' for b in body if b.get('zkontroluj')]
    out = {'titulek': titulek, 'perex': perex, 'body': [{k: v for k, v in b.items() if not k.startswith('_')} for b in body]}
    if zkontroluj:
        out['zkontroluj'] = ' '.join(zkontroluj)
    for b in out['body']:
        b.pop('zkontroluj', None)
        if not b.get('srovnani'):
            b.pop('srovnani', None)
    return out


def souhrn_yaml(sh: dict) -> list[str]:
    radky = ['# souhrn měsíce lidskou řečí: titulek a perex jsou na úvodní stránce, celý souhrn nahoře na stránce Novinky',
             'souhrn:']
    for k in ('titulek', 'perex', 'text', 'zkontroluj'):
        if sh.get(k):
            radky.append(f'  {k}: {yaml_text(sh[k])}')
    radky.append('  body:')
    for b in sh['body']:
        radky.append(f'    - id: "{b["id"]}"')
        for k in ('tema', 'ikona', 'ton', 'stav', 'cislo', 'popisCisla', 'veta', 'text', 'zdroj', 'url', 'novinka'):
            if b.get(k):
                radky.append(f'      {k}: {yaml_text(b[k])}')
        if b.get('srovnani'):
            radky.append(f'      srovnani: {json.dumps(b["srovnani"], ensure_ascii=False, separators=(", ", ": "))}')
    return radky


def souhrn_do_souboru(soubor: Path, sh: dict) -> None:
    """Vloží (nebo nahradí) blok souhrn: do hlavičky existujícího vydání."""
    radky = soubor.read_text(encoding='utf-8').split('\n')
    # starý souhrn pryč (od komentáře nad ním po další klíč nejvyšší úrovně)
    out, preskoc = [], False
    for r in radky:
        if r.startswith('# souhrn měsíce') or r == 'souhrn:':
            preskoc = True
            continue
        if preskoc and (r.startswith('  ') or r.strip() == ''):
            continue
        preskoc = False
        out.append(r)
    i = out.index('polozky:')
    out[i:i] = souhrn_yaml(sh)
    soubor.write_text('\n'.join(out), encoding='utf-8')


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


def stahni_vse() -> list[dict]:
    polozky = []
    for f in UKAZATELE:
        try:
            polozky += f()
            print(f'  {f.__name__}: OK')
        except Exception as ex:
            print(f'  {f.__name__}: CHYBA {ex}', file=sys.stderr)
    return polozky


def jen_souhrn() -> None:
    """python3 skripty/novinky.py --souhrn: přepočítá souhrn měsíce a vloží ho do posledního vydání (nic jiného nemění)."""
    vydani = sorted(SLOZKA.glob('*.md'), key=lambda f: f.stem)
    if not vydani:
        raise SystemExit('Zatím žádné vydání.')
    sh = souhrn(stahni_vse())
    if not sh:
        raise SystemExit('Na souhrn je málo dat.')
    souhrn_do_souboru(vydani[-1], sh)
    print(f'Souhrn vložen do src/content/novinky/{vydani[-1].name}: {sh["titulek"]}')


def main() -> None:
    SLOZKA.mkdir(parents=True, exist_ok=True)
    polozky = stahni_vse()
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
             f'hlavni: "{nove[0]["id"]}"']
    # souhrn měsíce ze všech nejnovějších čísel, nejen z těch, která přibyla od minula
    sh = souhrn(polozky)
    if sh:
        radky += souhrn_yaml(sh)
    radky.append('polozky:')
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
    if sh:
        popis += ['### Souhrn měsíce', '',
                  'Krátké shrnutí lidskou řečí nahoře v souboru (blok `souhrn:`). Titulek a perex jsou na úvodní stránce, '
                  'celý souhrn se šesti oblastmi nahoře na stránce Novinky. Věty skládá automat z čísel, klidně je přepiš po svém.', '',
                  f'**{sh["titulek"]}**', '', sh['perex'], '']
        for b in sh['body']:
            popis.append(f'- **{b["tema"]}** ({b["stav"]}, {b["cislo"]}): {b["veta"]}')
        if sh.get('zkontroluj'):
            popis.append(f'  - ⚠️ Zkontroluj: {sh["zkontroluj"]}')
        popis.append('')
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
    jen_souhrn() if '--souhrn' in sys.argv else main()
