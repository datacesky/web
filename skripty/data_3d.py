#!/usr/bin/env python3
"""Data pro 3D model Česka na stránce Mapa Česka. Uloží public/data/cesko3d.json.

Potřebuje balíčky shapely a pyproj (jednorázově: pip install shapely pyproj). Spuštění ze složky webu:

    python3 skripty/data_3d.py

Zdroje:
  - ČSÚ DataStat, OBY01B01: počet obyvatel obcí k 31. 12. (2000 až poslední rok)
  - ČÚZK, INSPIRE Územní správní jednotky: hranice obcí (převzato z github.com/siwekm/czech-geojson, CC BY 4.0)
  - Souřadnice středů obcí s kódem obce (github.com/33bcdd/souradnice-mest); slouží jen k tomu, aby se
    hranice z ČÚZK (bez kódů) přiřadila správné obci: bod musí ležet uvnitř hranice
  - Natural Earth 1:10m: železnice a hlavní silnice (public domain)

Hustota v mřížce: obyvatelé každé obce se rozdělí rovnoměrně po ploše obce a sečtou se ve čtvercích
zhruba 3 × 3 km. Obce bez jednoznačné hranice jdou do čtverce, ve kterém leží jejich střed.
"""
import csv
import io
import json
import math
import os
import re
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

try:
    from shapely.geometry import shape, Point, Polygon, LineString, MultiLineString, box
    from shapely.strtree import STRtree
    import shapely
    import numpy as np
    from shapely.ops import unary_union
    from pyproj import Geod
except ImportError:
    sys.exit('Chybí shapely nebo pyproj. Nainstaluj je: pip install shapely pyproj')

KOREN = Path(__file__).resolve().parent.parent
CIL = KOREN / 'public' / 'data' / 'cesko3d.json'
MAPA = json.loads((KOREN / 'src' / 'data' / 'cesko-mapa.json').read_text(encoding='utf-8'))
KRAJE = json.loads((KOREN / 'src' / 'data' / 'kraje.json').read_text(encoding='utf-8'))
P = MAPA['projekce']  # d3.geoMercator: x = k·λ + tx, y = ty − k·ln(tan(π/4 + φ/2))
NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/'
BUNKA = 6.0  # velikost čtverce v jednotkách mapy (1 jednotka ≈ 0,49 km)
geod = Geod(ellps='WGS84')


# Stažené soubory se ukládají do dočasné složky, ať se 400 MB od ČSÚ nestahuje při každém spuštění znovu.
CACHE = Path(os.environ.get('DATA3D_CACHE', Path(tempfile.gettempdir()) / 'datacesky-3d'))


def stahni(url: str) -> bytes:
    soubor = CACHE / re.sub(r'[^A-Za-z0-9._-]+', '_', url.split('//', 1)[1])
    if soubor.exists():
        return soubor.read_bytes()
    for pokus in range(4):
        try:
            print('  stahuji', url, file=sys.stderr)
            req = urllib.request.Request(url, headers={'User-Agent': 'datacesky.cz (data.cesky@gmail.com)'})
            with urllib.request.urlopen(req, timeout=600) as r:
                data = r.read()
            CACHE.mkdir(parents=True, exist_ok=True)
            soubor.write_bytes(data)
            return data
        except Exception as ex:
            print(f'    nepovedlo se ({ex}), zkouším znovu', file=sys.stderr)
            time.sleep(5 * (pokus + 1))
    sys.exit(f'Nepodařilo se stáhnout {url}')


def promitni(lon, lat):
    return P['k'] * math.radians(lon) + P['tx'], P['ty'] - P['k'] * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def promitni_pole(xy):
    lon, lat = np.radians(xy[:, 0]), np.radians(xy[:, 1])
    return np.column_stack([P['k'] * lon + P['tx'], P['ty'] - P['k'] * np.log(np.tan(np.pi / 4 + lat / 2))])


def km_na_jednotku(y):
    lat = 2 * math.atan(math.exp((P['ty'] - y) / P['k'])) - math.pi / 2
    return 6371.0088 * math.cos(lat) / P['k']


def obrys_polygon():
    """Obrys Česka z SVG cesty v cesko-mapa.json (už promítnutý)."""
    casti = []
    for sub in re.findall(r'M[^M]+', MAPA['obrys']):
        body = [tuple(map(float, b)) for b in re.findall(r'(-?\d+\.?\d*),(-?\d+\.?\d*)', sub)]
        if len(body) >= 3:
            casti.append(Polygon(body).buffer(0))
    return unary_union(casti)


def obyvatele():
    text = stahni('https://data.csu.gov.cz/opendata/sady/OBY01B01/distribuce/csv').decode('utf-8-sig')
    pop, jmena = {}, {}
    for x in csv.DictReader(io.StringIO(text)):
        if x['IndicatorType'] != '2406K' or x['POHL2'] != '0':
            continue
        k = x['UZ24596C']
        if not (k.isdigit() and len(k) == 6):
            continue
        pop.setdefault(k, {})[int(x['CasR'])] = int(float(x['Hodnota']))
        jmena[k] = x['Všechna území '].strip() if 'Všechna území ' in x else x['Všechna území'].strip()
    return pop, jmena


def jmeno_obce(s: str) -> str:
    m = re.match(r'(.*?) \(okr\. (.*)\)$', s)
    return f'{m.group(1)}|{m.group(2)}' if m and m.group(2) else s


def cary(soubor, vyber, obrys, tolerance=0.35):
    d = json.loads(stahni(NE + soubor))
    out = []
    for f in d['features']:
        g = f['geometry']
        if not g or not vyber(f['properties']):
            continue
        linie = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
        for l in linie:
            if not any(11.8 <= x <= 19.0 and 48.4 <= y <= 51.2 for x, y in l):
                continue
            cesta = LineString([promitni(x, y) for x, y in l]).intersection(obrys)
            if cesta.is_empty:
                continue
            for c in (cesta.geoms if hasattr(cesta, 'geoms') else [cesta]):
                if c.geom_type != 'LineString' or c.length < 2:
                    continue
                c = c.simplify(tolerance)
                out.append([[round(x, 1), round(y, 1)] for x, y in c.coords])
    return out


def main():
    obrys = obrys_polygon()
    print('Obyvatelé obcí (ČSÚ)…', file=sys.stderr)
    pop, jmena = obyvatele()
    roky = sorted({r for v in pop.values() for r in v})
    posledni = roky[-1]
    kody = sorted(k for k, v in pop.items() if v.get(posledni))
    print(f'  {len(kody)} obcí, {roky[0]}–{posledni}, celkem {sum(pop[k][posledni] for k in kody):,}', file=sys.stderr)

    print('Souřadnice a hranice obcí…', file=sys.stderr)
    sour = {x['Kód obce']: (float(x['Longitude']), float(x['Latitude']))
            for x in csv.DictReader(io.StringIO(stahni('https://raw.githubusercontent.com/33bcdd/souradnice-mest/master/souradnice.csv').decode('utf-8')))}
    chybi = [k for k in kody if k not in sour]
    if chybi:
        sys.exit(f'Chybí souřadnice obcí: {chybi[:10]}')
    hranice = [shape(f['geometry']) for f in json.loads(stahni('https://raw.githubusercontent.com/siwekm/czech-geojson/master/obce.json'))['features']]
    strom = STRtree(hranice)
    v_polygonu = {}
    for k in kody:
        bod = Point(*sour[k])
        hit = [i for i in strom.query(bod) if hranice[i].contains(bod)]
        if not hit:
            sys.exit(f'Střed obce {k} neleží v žádné hranici z ČÚZK')
        v_polygonu.setdefault(int(hit[0]), []).append(k)
    # polygon s jedním bodem patří té obci; sporné body dostanou nejbližší volný polygon
    prirazeni = {v[0]: i for i, v in v_polygonu.items() if len(v) == 1}
    volne = [i for i in range(len(hranice)) if i not in v_polygonu]
    sporne = [(k, i) for i, v in v_polygonu.items() if len(v) > 1 for k in v]
    pary = sorted((hranice[j].distance(Point(*sour[k])), k, j) for k, _ in sporne for j in volne)
    for _, k, j in pary:
        if k not in prirazeni and j in volne:
            prirazeni[k] = j
            volne.remove(j)
    for i, v in v_polygonu.items():
        if len(v) > 1:
            zbyly = [k for k in v if k not in prirazeni]
            if len(zbyly) == 1:
                prirazeni[zbyly[0]] = i
    print(f'  hranice přiřazené {len(prirazeni)} z {len(kody)} obcí', file=sys.stderr)

    print('Mřížka hustoty…', file=sys.stderr)
    minx, miny, maxx, maxy = obrys.bounds
    bunky, plochy = [], []
    y = math.floor(miny / BUNKA) * BUNKA
    while y < maxy:
        x = math.floor(minx / BUNKA) * BUNKA
        while x < maxx:
            b = box(x, y, x + BUNKA, y + BUNKA)
            if b.intersects(obrys):
                cast = b.intersection(obrys).area
                if cast > 0.05 * BUNKA * BUNKA:
                    bunky.append(b)
                    plochy.append(cast * km_na_jednotku(y + BUNKA / 2) ** 2)
            x += BUNKA
        y += BUNKA
    strom_b = STRtree(bunky)
    lide = [0.0] * len(bunky)
    for k in kody:
        n = pop[k][posledni]
        if k in prirazeni:
            g = shapely.transform(hranice[prirazeni[k]], promitni_pole).buffer(0)
            celkem = g.area
            idx = [int(i) for i in strom_b.query(g)]
            podily = [(i, bunky[i].intersection(g).area) for i in idx]
            soucet = sum(p for _, p in podily) or celkem
            for i, p in podily:
                if p > 0:
                    lide[i] += n * p / soucet
        else:
            bod = Point(*promitni(*sour[k]))
            idx = [int(i) for i in strom_b.query(bod) if bunky[int(i)].intersects(bod)]
            if idx:
                lide[idx[0]] += n
    print(f'  {len(bunky)} čtverců, rozděleno {sum(lide):,.0f} obyvatel', file=sys.stderr)

    print('Železnice a silnice (Natural Earth)…', file=sys.stderr)
    zeleznice = cary('ne_10m_railroads.geojson', lambda p: True, obrys)
    silnice = cary('ne_10m_roads.geojson', lambda p: p.get('type') in ('Major Highway',) or p.get('expressway') == 1, obrys)

    obce = []
    for k in kody:
        # sloupec stojí v těžišti hranice obce z ČÚZK (u členitých obcí v bodě uvnitř), jen bez hranice v bodě ze souřadnic
        if k in prirazeni:
            g = hranice[prirazeni[k]]
            c = g.centroid if g.contains(g.centroid) else g.representative_point()
            x, y = promitni(c.x, c.y)
        else:
            x, y = promitni(*sour[k])
        obce.append({'k': k, 'n': jmeno_obce(jmena[k]), 'x': round(x, 1), 'y': round(y, 1), 'p': [pop[k].get(r, 0) for r in roky]})
    obce.sort(key=lambda o: -o['p'][-1])
    vystup = {
        'meta': {
            'roky': roky,
            'bunka_km': round(BUNKA * km_na_jednotku((miny + maxy) / 2), 2),
            'zdroje': {
                'obyvatele': 'ČSÚ, DataStat OBY01B01, počet obyvatel k 31. 12.',
                'hranice': 'ČÚZK, INSPIRE Územní správní jednotky',
                'doprava': 'Natural Earth 1:10m',
            },
        },
        'obrys': MAPA['obrys'],
        'kraje': [{'id': k['id'], 'nazev': k['nazev'], 'd': k['d']} for k in KRAJE['kraje']],
        # sloupce: kód, jméno|okres, x, y, obyvatelé po letech
        'obce': {
            'k': [o['k'] for o in obce], 'n': [o['n'] for o in obce],
            'x': [o['x'] for o in obce], 'y': [o['y'] for o in obce],
            'p': [o['p'] for o in obce],
        },
        'mrizka': {
            'bunka': BUNKA,
            'x': [round(b.bounds[0], 1) for b in bunky], 'y': [round(b.bounds[1], 1) for b in bunky],
            'hustota': [round(l / a, 1) if a else 0 for l, a in zip(lide, plochy)],
        },
        'zeleznice': zeleznice,
        'silnice': silnice,
        'vrcholy': MAPA['vrcholy'],
    }
    CIL.parent.mkdir(parents=True, exist_ok=True)
    CIL.write_text(json.dumps(vystup, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'Uloženo {CIL.relative_to(KOREN)} ({CIL.stat().st_size / 1e6:.2f} MB)', file=sys.stderr)


if __name__ == '__main__':
    main()
