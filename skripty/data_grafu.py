#!/usr/bin/env python3
"""Stáhne data pro vývoj v čase a „Porovnej se" u grafů a uloží je do src/data/grafy/.

Používá jen standardní knihovnu Pythonu, takže běží i v GitHub Actions bez instalace.
Spuštění ze složky webu:

    python3 skripty/data_grafu.py

Zdroje:
  - Eurostat, edat_lfse_03: podíl lidí 25–34 let s terciárním vzděláním (ISCED 5–8)
  - ČSÚ DataStat, CRUHVD1: hosté v hromadných ubytovacích zařízeních podle země rezidence
  - ČSÚ DataStat, MZDQ1: průměrná hrubá měsíční mzda (poslední čtvrtletí)
"""
import csv
import io
import json
import sys
import urllib.request
from datetime import date
from pathlib import Path

KOREN = Path(__file__).resolve().parent.parent
CIL = KOREN / 'src' / 'data' / 'grafy'
SVET = json.loads((KOREN / 'src' / 'data' / 'svet.json').read_text(encoding='utf-8'))
ZEME = SVET['zeme']  # A3 -> [český název, a2]
A2_NA_A3 = {a2.upper(): a3 for a3, (_, a2) in ZEME.items() if a2}
JMENO_NA_A3 = {n: a3 for a3, (n, _) in ZEME.items()}
DNES = date.today().isoformat()

EU27 = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES', 'FI', 'FR', 'HR', 'HU', 'IE', 'IT',
        'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK']


def stahni(url: str) -> bytes:
    req = urllib.request.Request(url, headers={'User-Agent': 'datacesky.cz (data.cesky@gmail.com)'})
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read()


def csu_csv(sada: str) -> list[dict]:
    data = stahni(f'https://data.csu.gov.cz/opendata/sady/{sada}/distribuce/csv').decode('utf-8-sig')
    return list(csv.DictReader(io.StringIO(data)))


def a3_z_eurostatu(kod: str) -> str:
    return A2_NA_A3['GR' if kod == 'EL' else kod]


# Názvy ČSÚ, které se liší od názvů na webu
CSU_NAZVY = {
    'Spojené státy': 'USA',
    'Velká Británie a Severní Irsko': 'GBR',
    'Korejská republika': 'KOR',
    'Čína': 'CHN',
    'Rusko': 'RUS',
    'Nizozemsko': 'NLD',
    'Nizozemské království': 'NLD',
    'Jižní Afrika': 'ZAF',
}
# Celky, které nejsou jedna dnešní země
CSU_VYNECHAT = {'Oceánie', 'Srbsko a Černá Hora'}


def vysokoskolaci() -> dict:
    url = ('https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/edat_lfse_03'
           '?sex=T&age=Y25-34&isced11=ED5-8&unit=PC&lang=EN')
    d = json.loads(stahni(url))
    dims, size = d['id'], d['size']
    gi = d['dimension']['geo']['category']['index']
    ti = d['dimension']['time']['category']['index']
    stav = d.get('status', {})

    def index(g: str, t: str) -> str:
        idx = {k: 0 for k in dims}
        idx['geo'], idx['time'] = gi[g], ti[t]
        n = 0
        for k, s in zip(dims, size):
            n = n * s + idx[k]
        return str(n)

    roky = [t for t in sorted(ti) if 2004 <= int(t)]
    zeme = {}
    for g in EU27:
        a3 = a3_z_eurostatu(g)
        hodnoty = {t: d['value'][index(g, t)] for t in roky if index(g, t) in d['value']}
        zeme[a3] = {'nazev': ZEME[a3][0], 'a2': ZEME[a3][1], 'hodnoty': hodnoty}
    eu = {t: d['value'][index('EU27_2020', t)] for t in roky if index('EU27_2020', t) in d['value']}
    zlomy = sorted({t for t in roky if stav.get(index('EU27_2020', t)) == 'b' or stav.get(index('CZ', t)) == 'b'})
    return {
        'zdroj': 'Eurostat (edat_lfse_03)',
        'zdrojUrl': 'https://ec.europa.eu/eurostat/databrowser/view/edat_lfse_03/default/table',
        'aktualizovanoZdrojem': d.get('updated', ''),
        'stazeno': DNES,
        'jednotka': '%',
        'desetinna': 1,
        'roky': roky,
        'reference': {'nazev': 'Průměr EU', 'hodnoty': eu},
        'zvyraznit': 'CZE',
        'zlomyRady': zlomy,
        'zeme': zeme,
    }


def turiste() -> dict:
    radky = [r for r in csu_csv('CRUHVD1') if r['Ukazatel'] == 'Počet hostů' and r['Uz012'] == 'CZ']
    roky = sorted({r['CasR'] for r in radky})
    souhrn = {r['CasR']: int(r['Hodnota']) for r in radky if r['Rezidence'] == 'Nerezidenti'}
    zeme: dict = {}
    nenamapovane = set()
    for r in radky:
        n = r['Rezidence']
        if n in ('Celkem', 'Rezidenti', 'Nerezidenti') or n.startswith('Ostatní') or n in CSU_VYNECHAT:
            continue
        a3 = CSU_NAZVY.get(n) or JMENO_NA_A3.get(n)
        if not a3:
            nenamapovane.add(n)
            continue
        z = zeme.setdefault(a3, {'nazev': ZEME[a3][0], 'a2': ZEME[a3][1], 'hodnoty': {}})
        z['hodnoty'][r['CasR']] = int(r['Hodnota'])
    if nenamapovane:
        print('  Bez názvu na webu (vynechané):', ', '.join(sorted(nenamapovane)), file=sys.stderr)
    return {
        'zdroj': 'ČSÚ, DataStat (CRUHVD1)',
        'zdrojUrl': 'https://data.csu.gov.cz/opendata/sady/CRUHVD1',
        'stazeno': DNES,
        'jednotka': 'hostů',
        'desetinna': 0,
        'roky': roky,
        'souhrn': {'nazev': 'Všichni hosté ze zahraničí', 'hodnoty': souhrn},
        'zeme': zeme,
    }


def mzda() -> dict:
    radky = [r for r in csu_csv('MZDQ1')
             if r['IndicatorType'] == '5958P' and r['CZNACEMZDY'] == 'A-S' and r['ZJIST'] == '0'
             and r['Uz0123vm.REGION'] == '' and r['Uz0123vm.KRAJ'] == '' and r['ISEKTORMZDH.ISEKTOR2'] == '0'
             and r['KATPMZD'] == '0' and r['ISEKTORMZDH.ISEKTOR5'] == '']
    posledni = max(radky, key=lambda r: r['CasQ'])
    return {
        'hodnota': round(float(posledni['Hodnota'])),
        'obdobi': posledni['Čtvrtletí'],
        'zdroj': 'ČSÚ, DataStat (MZDQ1)',
        'zdrojUrl': 'https://data.csu.gov.cz/opendata/sady/MZDQ1',
        'stazeno': DNES,
    }


def uloz(nazev: str, data: dict) -> None:
    CIL.mkdir(parents=True, exist_ok=True)
    (CIL / nazev).write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'  uloženo src/data/grafy/{nazev}')


if __name__ == '__main__':
    print('Vysokoškoláci (Eurostat)…')
    uloz('vysokoskolaci.json', vysokoskolaci())
    print('Zahraniční turisté (ČSÚ)…')
    uloz('turiste.json', turiste())
    print('Průměrná mzda (ČSÚ)…')
    uloz('mzda.json', mzda())
