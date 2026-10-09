#!/usr/bin/env python3
"""Novinky z dat: jednou měsíčně stáhne čerstvá čísla z ČSÚ a Eurostatu, vybere to nejzajímavější
a připraví vydání do src/content/novinky/RRRR-MM.md. Spouští ho GitHub Action (.github/workflows/novinky.yml),
která výsledek pošle jako návrh ke schválení (pull request). Nic se nezveřejní bez tvého Merge.

Ručně ze složky webu:

    python3 skripty/novinky.py

Věty se skládají ze šablon přímo z čísel, nic se nedomýšlí. Položky, které je potřeba ověřit
(velké skoky cen potravin bývají sezóna nebo akce), mají v návrhu poznámku „zkontroluj".
Používá jen standardní knihovnu Pythonu.
"""
import csv
import io
import json
import os
import re
import statistics
import sys
import unicodedata
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


def cislo(v: float, d: int = 1) -> str:
    s = f'{v:,.{d}f}'.replace(',', ' ').replace('.', ',')
    return s.replace('-', '−')


def se_znamenkem(v: float, d: int = 1) -> str:
    return ('+' if v > 0 else '') + cislo(v, d)


def mesic_text(obdobi: str, predlozka: bool = False, rok: bool = True) -> str:
    r, m = obdobi.split('-')
    return f'{(V_MESICI if predlozka else MESIC)[int(m) - 1]}{f" {r}" if rok else ""}'


def predchozi(obdobi: str, aktualni: str) -> str:
    """„v červenci“ ve stejném roce, „v prosinci 2025“ přes přelom roku"""
    return mesic_text(obdobi, True, rok=obdobi[:4] != aktualni[:4])


def slug(text: str) -> str:
    bez = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', bez.lower()).strip('-')


def stahni(url: str) -> bytes:
    req = urllib.request.Request(url, headers={'User-Agent': 'datacesky.cz (data.cesky@gmail.com)'})
    with urllib.request.urlopen(req, timeout=180) as r:
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
        'id': 'inflace', 'obdobi': t,
        'nadpis': f'Inflace {mesic_text(t, True)}', 'cislo': f'{cislo(rada[t])} %', 'text': text,
        'zdroj': 'ČSÚ, Eurostat', 'sada': 'CEN0101H, prc_hicp_minr', 'url': csu_url('CEN0101H'),
        'skore': z_skore(rada[t] - rada[p], zmeny) + 1.5,
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
    return [{
        'id': 'pohonne-hmoty', 'obdobi': t,
        'nadpis': f'Ceny pohonných hmot, {int(tyden)}. týden {rok}', 'cislo': f'{cislo(nafta[t], 2)} Kč/l',
        'popisCisla': 'nafta',
        'text': 'Průměrné ceny za litr: ' + '; '.join(casti) + '.' + rekord,
        'zdroj': 'ČSÚ', 'sada': 'CENPHMT', 'url': csu_url('CENPHMT'),
        'skore': z_skore(p_nafta, zmeny),
    }]


def nezamestnanost() -> list[dict]:
    EU27 = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES', 'FI', 'FR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK']
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
    return [{
        'id': 'nezamestnanost', 'obdobi': t,
        'nadpis': f'Nezaměstnanost {mesic_text(t, True)}', 'cislo': f'{cislo(cz)} %',
        'text': text + ' Údaje jsou sezónně očištěné.',
        'zdroj': 'Eurostat', 'sada': 'une_rt_m', 'url': 'https://ec.europa.eu/eurostat/databrowser/view/une_rt_m/default/table',
        'skore': z_skore(cz - e[('CZ', p)], zmeny) + 0.5,
    }]


def mzdy() -> list[dict]:
    r = [x for x in csu('MZDQ1')
         if x['CZNACEMZDY'] == 'A-S' and x['ZJIST'] == '0' and x['Uz0123vm.REGION'] == '' and x['Uz0123vm.KRAJ'] == ''
         and x['ISEKTORMZDH.ISEKTOR2'] == '0' and x['KATPMZD'] == '0' and x['ISEKTORMZDH.ISEKTOR5'] == '']
    prumer = {x['CasQ']: float(x['Hodnota']) for x in r if x['IndicatorType'] == '5958P'}
    rozdil = {x['CasQ']: float(x['Hodnota']) for x in r if x['IndicatorType'] == '5958PROZ'}
    t = max(prumer)
    nazev = next(x['Čtvrtletí'] for x in r if x['CasQ'] == t)
    text = f'Průměrná hrubá měsíční mzda v {nazev}.'
    if t in rozdil:
        pct = rozdil[t] / (prumer[t] - rozdil[t]) * 100
        text += f' Proti stejnému čtvrtletí před rokem je o {cislo(round(rozdil[t]), 0)} Kč vyšší ({se_znamenkem(pct)} %), bez započtení inflace. Medián, tedy mzda „typického“ zaměstnance, bývá nižší.'
    return [{
        'id': 'mzdy', 'obdobi': t,
        'nadpis': f'Průměrná mzda, {nazev}', 'cislo': f'{cislo(round(prumer[t]), 0)} Kč',
        'text': text, 'zdroj': 'ČSÚ', 'sada': 'MZDQ1', 'url': csu_url('MZDQ1'), 'skore': 1.2,
    }]


def potraviny() -> list[dict]:
    r = csu('CEN0101N')
    ceny = {}
    for x in r:
        ceny.setdefault(x['Druh zboží'], {})[x['CasM']] = float(x['Hodnota'])
    obd = sorted({x['CasM'] for x in r})
    t, p = obd[-1], obd[-2]
    zmeny = []
    for nazev, rada in ceny.items():
        if t in rada and p in rada and rada[p] > 0:
            zmeny.append((nazev, rada[p], rada[t], (rada[t] / rada[p] - 1) * 100))
    zmeny.sort(key=lambda z: z[3])
    vyber = zmeny[-1:] + zmeny[:1]
    out = []
    for nazev, a, b, pct in vyber:
        m = re.match(r'(.*?)\s*\[(.*)\]', nazev)
        jmeno, jednotka = (m.group(1), m.group(2)) if m else (nazev, '')
        jednotka = jednotka.replace('1 ', '')
        out.append({
            'id': f'cena-{slug(jmeno)}', 'obdobi': t,
            'nadpis': f'{jmeno}: {se_znamenkem(pct, 0)} % za měsíc', 'cislo': f'{cislo(b, 2)} Kč',
            'popisCisla': f'za {jednotka}' if jednotka else '',
            'text': f'Průměrná cena {mesic_text(t, True)}: {cislo(b, 2)} Kč{" za " + jednotka if jednotka else ""}. {predchozi(p, t).capitalize()} {cislo(a, 2)} Kč.',
            'zdroj': 'ČSÚ', 'sada': 'CEN0101N', 'url': csu_url('CEN0101N'),
            'skore': min(abs(pct) / 40, 1.0),
            'zkontroluj': 'Velký měsíční skok bývá sezóna (zelenina, ovoce) nebo akční cena. Ověř, jestli to dává smysl, a případně položku smaž.',
        })
    return out


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
    for f in (inflace, pohonne_hmoty, nezamestnanost, mzdy, potraviny):
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
        for k in ('nadpis', 'cislo', 'popisCisla', 'text', 'zdroj', 'sada', 'url', 'zkontroluj'):
            if p.get(k):
                radky.append(f'    {k}: {yaml_text(p[k])}')
    radky += ['---', '', 'Co nového ukázala data, která Český statistický úřad a Eurostat zveřejnili za poslední měsíc.', '']
    (SLOZKA / f'{VYDANI}.md').write_text('\n'.join(radky), encoding='utf-8')
    print(f'Uloženo src/content/novinky/{VYDANI}.md ({len(nove)} položek)')

    # Popis návrhu pro pull request
    popis = [f'## Novinky z dat: {MESIC[DNES.month - 1]} {DNES.year}', '',
             'Automaticky připravený návrh. Projdi čísla, případně uprav text v souboru '
             f'`src/content/novinky/{VYDANI}.md` (záložka Files changed → tři tečky → Edit file) a klikni **Merge**. Pak se novinky objeví na webu.', '']
    for p in nove:
        popis.append(f'- **{p["nadpis"]}** ({p["cislo"]}): {p["text"]} [{p["sada"]}]({p["url"]})')
        if p.get('zkontroluj'):
            popis.append(f'  - ⚠️ Zkontroluj: {p["zkontroluj"]}')
    cil = os.environ.get('NAVRH_POPIS')
    if cil:
        Path(cil).write_text('\n'.join(popis) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
