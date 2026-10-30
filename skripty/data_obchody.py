"""Supermarkety na mapě: z exportu OpenStreetMap (Overpass Turbo, GeoJSON) vyrobí public/data/obchody.json.

Jak obnovit (jednou za čas, třeba při aktualizaci grafu Supermarkety v Česku):
  1. Na https://overpass-turbo.eu vlož tenhle dotaz, klikni Spustit, pak Export → GeoJSON → stáhnout:

       [out:json][timeout:180];
       area["ISO3166-1"="CZ"][admin_level=2]->.cz;
       nwr["shop"~"supermarket|convenience|department_store"]["brand"~"Penny|Albert|Lidl|Billa|Tesco|Kaufland|Globus",i](area.cz);
       out center tags;

  2. pip install shapely
  3. python3 skripty/data_obchody.py cesta/k/export.geojson

Skript sjednotí názvy značek (PENNY → Penny, Tesco Expres → Tesco …), vyhodí zdvojené záznamy stejné značky
blíž než 250 m od sebe (v OSM bývá prodejna zakreslená jako bod i jako budova), přepočítá polohy do souřadnic
mapy Česka a ke každé prodejně určí kraj.
"""
import datetime
import json
import math
import os
import re
import sys

from shapely.geometry import Point, Polygon

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VYSTUP = os.path.join(KOREN, 'public', 'data', 'obchody.json')

# Pořadí = pořadí v legendě (podle počtu prodejen v grafu)
RETEZCE = ['penny', 'albert', 'lidl', 'billa', 'tesco', 'kaufland', 'globus']
NAZVY = {'penny': 'Penny', 'albert': 'Albert', 'lidl': 'Lidl', 'billa': 'Billa', 'tesco': 'Tesco', 'kaufland': 'Kaufland', 'globus': 'Globus'}


def retezec(brand: str):
    b = (brand or '').lower()
    for r in RETEZCE:
        if r in b:
            return r
    return None


def format_prodejny(r, p):
    """Menší formáty, které řetězec počítá zvlášť (Tesco Expres, Billa Stop & Shop, Globus Fresh, Albert Hypermarket)."""
    t = f"{p.get('brand', '')} {p.get('name', '')}".lower()
    if r == 'tesco' and ('expres' in t or p.get('shop') == 'convenience'):
        return 'Tesco Expres'
    if r == 'tesco' and 'extra' in t:
        return 'Tesco Extra'
    if r == 'billa' and ('stop' in t or 'viva' in t):
        return 'Billa Stop & Shop'
    if r == 'globus' and 'fresh' in t:
        return 'Globus Fresh'
    if r == 'albert' and 'hypermarket' in t:
        return 'Albert Hypermarket'
    return ''


def kraje_polygony():
    data = json.load(open(os.path.join(KOREN, 'src', 'data', 'kraje.json'), encoding='utf-8'))
    vysledek = {}
    for k in data['kraje']:
        casti = []
        for kus in re.findall(r'M[^M]+', k['d']):
            body = [tuple(map(float, b.split(','))) for b in re.findall(r'-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?', kus)]
            if len(body) >= 3:
                casti.append(Polygon(body).buffer(0))
        # Cesty se kreslí s fill-rule evenodd: vnitřní kruh je díra (Praha uvnitř Středočeského kraje)
        g = casti[0]
        for c in casti[1:]:
            g = g.symmetric_difference(c)
        vysledek[k['id']] = g
    return vysledek


def main():
    if len(sys.argv) < 2:
        sys.exit('Použití: python3 skripty/data_obchody.py export.geojson')
    gj = json.load(open(sys.argv[1], encoding='utf-8'))
    P = json.load(open(os.path.join(KOREN, 'src', 'data', 'cesko-mapa.json'), encoding='utf-8'))['projekce']

    def xy(lon, lat):
        return (P['k'] * math.radians(lon) + P['tx'], P['ty'] - P['k'] * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)))

    def metru(a, b):
        dx = math.radians(b[0] - a[0]) * math.cos(math.radians((a[1] + b[1]) / 2))
        dy = math.radians(b[1] - a[1])
        return 6371000 * math.hypot(dx, dy)

    kraje = kraje_polygony()
    prodejny, zdvojene, bez_znacky = [], 0, 0
    for f in gj['features']:
        p = f.get('properties', {})
        r = retezec(p.get('brand') or p.get('name'))
        if not r or f.get('geometry', {}).get('type') != 'Point':
            bez_znacky += 1
            continue
        lon, lat = f['geometry']['coordinates']
        if any(q['r'] == r and metru((q['lon'], q['lat']), (lon, lat)) < 250 for q in prodejny):
            zdvojene += 1
            continue
        x, y = xy(lon, lat)
        bod = Point(x, y)
        kraj = next((k for k, g in kraje.items() if g.contains(bod)), None)
        if kraj is None:  # u hranice kraje nebo státu: nejbližší kraj
            kraj = min(kraje, key=lambda k: kraje[k].distance(bod))
        prodejny.append({'r': r, 'lon': lon, 'lat': lat, 'x': round(x, 1), 'y': round(y, 1), 'kraj': kraj,
                         'f': format_prodejny(r, p), 'm': p.get('addr:city') or p.get('addr:place') or ''})

    pocty = {r: sum(1 for q in prodejny if q['r'] == r) for r in RETEZCE}
    po_krajich = {}
    for q in prodejny:
        po_krajich.setdefault(q['kraj'], {r: 0 for r in RETEZCE})[q['r']] += 1
    formaty = sorted({q['f'] for q in prodejny if q['f']})

    vystup = {
        'stav': gj.get('timestamp', '')[:10] or datetime.date.today().isoformat(),
        'zdroj': 'OpenStreetMap (© přispěvatelé OpenStreetMap, ODbL), export přes Overpass',
        'retezce': [{'id': r, 'nazev': NAZVY[r], 'pocet': pocty[r]} for r in RETEZCE],
        'formaty': formaty,
        'kraje': po_krajich,
        # [x, y, index řetězce, index formátu (-1 = běžná prodejna), město]
        'body': [[q['x'], q['y'], RETEZCE.index(q['r']), formaty.index(q['f']) if q['f'] else -1, q['m']] for q in prodejny],
    }
    os.makedirs(os.path.dirname(VYSTUP), exist_ok=True)
    with open(VYSTUP, 'w', encoding='utf-8') as f:
        json.dump(vystup, f, ensure_ascii=False, separators=(',', ':'))
    print(f'{len(prodejny)} prodejen, {zdvojene} zdvojených záznamů vynecháno, {bez_znacky} bez rozpoznané značky')
    for r in RETEZCE:
        print(f'  {NAZVY[r]}: {pocty[r]}')
    print(f'Uloženo do {VYSTUP} ({os.path.getsize(VYSTUP) // 1024} kB)')


if __name__ == '__main__':
    main()
