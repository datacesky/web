"""Supermarkety na mapě: z OpenStreetMap vyrobí public/data/obchody.json (prodejny) a public/data/obce.json (hledání obcí).

Jak obnovit:
  A) Automaticky: GitHub Action „Supermarkety z OpenStreetMap“ (.github/workflows/obchody.yml) jednou měsíčně
     stáhne čerstvá data a pošle je jako návrh ke schválení. Ručně: Actions → Supermarkety z OpenStreetMap → Run workflow.
  B) Z vlastního exportu: na https://overpass-turbo.eu vlož DOTAZ níže, Spustit, Exportovat → raw OSM data
     (nebo GeoJSON) → stáhnout, a pak:
       pip install shapely
       python3 skripty/data_obchody.py cesta/k/exportu.json
  C) Stáhnout přímo (potřebuje přístup na overpass-api.de):
       python3 skripty/data_obchody.py --stahnout

Skript sjednotí názvy značek (PENNY → Penny, Tesco Expres → Tesco …), sloučí zdvojené záznamy stejné značky
blíž než 250 m od sebe (v OSM bývá prodejna zakreslená jako bod i jako budova), ke každé prodejně určí kraj
a obec a uloží přesnou polohu, adresu a otevírací dobu. Když by nových prodejen bylo o víc než 10 % méně než
v dosavadním souboru, nic nepřepíše (Overpass občas vrátí neúplná data).
"""
import datetime
import json
import math
import os
import re
import sys
import urllib.parse
import urllib.request

from shapely.geometry import Point, Polygon

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VYSTUP = os.path.join(KOREN, 'public', 'data', 'obchody.json')
VYSTUP_OBCE = os.path.join(KOREN, 'public', 'data', 'obce.json')

DOTAZ = """[out:json][timeout:300];
area["ISO3166-1"="CZ"][admin_level=2]->.cz;
nwr["shop"~"supermarket|convenience|department_store"]["brand"~"Penny|Albert|Lidl|Billa|Tesco|Kaufland|Globus",i](area.cz);
out center;
node["place"~"^(city|town|village|suburb)$"](area.cz);
out;"""
SERVERY = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter']

# Pořadí = pořadí v legendě (podle počtu prodejen v grafu)
RETEZCE = ['penny', 'albert', 'lidl', 'billa', 'tesco', 'kaufland', 'globus']
NAZVY = {'penny': 'Penny', 'albert': 'Albert', 'lidl': 'Lidl', 'billa': 'Billa', 'tesco': 'Tesco', 'kaufland': 'Kaufland', 'globus': 'Globus'}
TYPY_OBCI = ['city', 'town', 'village', 'suburb']


def retezec(brand: str):
    b = (brand or '').lower()
    for r in RETEZCE:
        if r in b:
            return r
    return None


def format_prodejny(r, p):
    """Menší a větší formáty, které řetězec počítá zvlášť (Tesco Expres, Billa Stop & Shop, Globus Fresh, Albert Hypermarket)."""
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


def adresa(p):
    """Ulice a číslo tak, jak se píšou v Česku: Kladenská 1234/5, u obcí bez ulic jen obec a číslo popisné."""
    ulice = p.get('addr:street') or p.get('addr:place') or ''
    cislo = p.get('addr:housenumber') or ''
    if not cislo:
        cp, co = p.get('addr:conscriptionnumber'), p.get('addr:streetnumber')
        cislo = f'{cp}/{co}' if cp and co else (cp or co or '')
    return ' '.join(x for x in (ulice, cislo) if x).strip()


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


def nacti_prvky(cesta):
    """Vrátí seznam (vlastnosti, lon, lat, osm_id) z raw OSM JSON (Overpass) i z GeoJSON (Overpass Turbo)."""
    gj = json.load(open(cesta, encoding='utf-8'))
    prvky, cas = [], ''
    if 'elements' in gj:  # raw Overpass JSON
        cas = (gj.get('osm3s') or {}).get('timestamp_osm_base', '')
        for e in gj['elements']:
            if 'lat' in e:
                lon, lat = e['lon'], e['lat']
            elif 'center' in e:
                lon, lat = e['center']['lon'], e['center']['lat']
            else:
                continue
            prvky.append((e.get('tags') or {}, lon, lat, e['type'][0] + str(e['id'])))
    else:  # GeoJSON
        cas = gj.get('timestamp', '')
        for f in gj.get('features', []):
            g = f.get('geometry') or {}
            p = f.get('properties') or {}
            if g.get('type') == 'Point':
                lon, lat = g['coordinates']
            elif g.get('type') in ('Polygon', 'MultiPolygon'):
                from shapely.geometry import shape
                c = shape(g).centroid
                lon, lat = c.x, c.y
            else:
                continue
            ident = str(f.get('id') or p.get('@id') or '')
            m = re.match(r'(node|way|relation)/(\d+)', ident)
            prvky.append((p, lon, lat, (m.group(1)[0] + m.group(2)) if m else ''))
    return prvky, cas


def stahni(cil):
    data = urllib.parse.urlencode({'data': DOTAZ}).encode()
    posledni = None
    for server in SERVERY:
        try:
            req = urllib.request.Request(server, data=data, headers={'User-Agent': 'datacesky.cz (data.cesky@gmail.com)', 'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=360) as r, open(cil, 'wb') as f:
                f.write(r.read())
            json.load(open(cil, encoding='utf-8'))  # ověří, že nepřišla chybová stránka
            print(f'Staženo z {server}')
            return
        except Exception as e:  # noqa: BLE001 – zkusí další server
            posledni = e
            print(f'{server}: {e}')
    sys.exit(f'Stažení selhalo: {posledni}')


GRAF = os.path.join(KOREN, 'src', 'content', 'grafy', 'supermarkety-v-cesku.md')


def aktualizuj_graf(pocty):
    """Počty z mapy přepíše i do grafu Supermarkety v Česku (karta na Žebříčcích, Porovnej se), ať všude sedí stejná čísla."""
    if not os.path.exists(GRAF):
        return
    text = open(GRAF, encoding='utf-8').read()
    poradi = sorted(RETEZCE, key=lambda r: -pocty[r])
    radky = [f'  - {{ nazev: "{NAZVY[r]}", hodnota: {pocty[r]}{", kategorie: \"Nejvíc prodejen\"" if i == 0 else ""} }}' for i, r in enumerate(poradi)]
    novy = re.sub(r'(?m)^polozky:\n(?:  - .*\n)+', 'polozky:\n' + '\n'.join(radky) + '\n', text, count=1)
    if novy != text:
        open(GRAF, 'w', encoding='utf-8').write(novy)


def main():
    if len(sys.argv) < 2:
        sys.exit('Použití: python3 skripty/data_obchody.py export.json   nebo   python3 skripty/data_obchody.py --stahnout')
    vstup = sys.argv[1]
    if vstup == '--stahnout':
        vstup = os.path.join(os.environ.get('RUNNER_TEMP', '/tmp'), 'overpass-obchody.json')
        stahni(vstup)

    prvky, cas = nacti_prvky(vstup)
    P = json.load(open(os.path.join(KOREN, 'src', 'data', 'cesko-mapa.json'), encoding='utf-8'))['projekce']

    def xy(lon, lat):
        return (P['k'] * math.radians(lon) + P['tx'], P['ty'] - P['k'] * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)))

    def metru(a, b):
        dx = math.radians(b[0] - a[0]) * math.cos(math.radians((a[1] + b[1]) / 2))
        dy = math.radians(b[1] - a[1])
        return 6371000 * math.hypot(dx, dy)

    kraje = kraje_polygony()
    poradi_kraju = list(kraje)

    def kraj_bodu(lon, lat):
        bod = Point(*xy(lon, lat))
        k = next((k for k, g in kraje.items() if g.contains(bod)), None)
        return k or min(kraje, key=lambda k: kraje[k].distance(bod))  # u hranice: nejbližší kraj

    # Obce a městské části
    obce = []
    for p, lon, lat, _ in prvky:
        if p.get('place') in TYPY_OBCI and p.get('name') and not p.get('shop'):
            obce.append({'n': p['name'], 'lon': lon, 'lat': lat, 't': TYPY_OBCI.index(p['place']), 'pop': int(re.sub(r'\D', '', p.get('population', '')) or 0)})

    # Ke každé městské části město, pod které patří (Poruba → Ostrava), k obci nejbližší město kvůli rozlišení
    # stejných jmen (18 obcí Lhota). Větší sídla mají větší dosah: centrum Ostravy je od Poruby dál než Klimkovice.
    mesta = [o for o in obce if o['t'] <= 1]
    def vaha(o):
        return 4 if o['t'] == 0 else 1.6 if o['t'] == 1 else 1

    def nejblizsi(kandidati, lon, lat, max_m):
        blizko = [o for o in kandidati if abs(o['lat'] - lat) < max_m / 70000 and abs(o['lon'] - lon) < max_m / 45000]
        if not blizko:
            return None
        o = min(blizko, key=lambda o: metru((o['lon'], o['lat']), (lon, lat)) / vaha(o))
        return o if metru((o['lon'], o['lat']), (lon, lat)) < max_m * vaha(o) / 4 else None

    for o in obce:
        o['u'] = ''
        if o['t'] >= 2:
            m = nejblizsi([x for x in mesta if x['n'] != o['n']] if o['t'] == 2 else mesta, o['lon'], o['lat'], 40000 if o['t'] == 3 else 25000)
            o['u'] = m['n'] if m else ''

    def nejblizsi_obec(lon, lat):
        """Obec prodejny, když v OSM chybí adresa: nejbližší sídlo, u městské části její město."""
        o = nejblizsi(obce, lon, lat, 14000)
        if not o:
            return ''
        return (o['u'] or o['n']) if o['t'] == 3 else o['n']

    # Prodejny
    prodejny, zdvojene, bez_znacky, zavrene = [], 0, 0, 0
    for p, lon, lat, osm in prvky:
        if not p.get('shop'):
            continue
        r = retezec(p.get('brand') or p.get('name'))
        if not r:
            bez_znacky += 1
            continue
        if (p.get('opening_hours') or '').strip().lower() in ('closed', 'off'):  # v OSM označená jako trvale zavřená
            zavrene += 1
            continue
        nova = {'r': r, 'lon': lon, 'lat': lat, 'f': format_prodejny(r, p), 'a': adresa(p),
                'm': p.get('addr:city') or '', 'o': (p.get('opening_hours') or '').strip(), 'id': osm}
        dvojce = next((q for q in prodejny if q['r'] == r and metru((q['lon'], q['lat']), (lon, lat)) < 250), None)
        if dvojce:
            zdvojene += 1
            for k in ('f', 'a', 'm', 'o'):  # doplní, co prvnímu záznamu chybí
                if not dvojce[k] and nova[k]:
                    dvojce[k] = nova[k]
            continue
        prodejny.append(nova)

    for q in prodejny:
        q['kraj'] = kraj_bodu(q['lon'], q['lat'])
        if not q['m']:
            q['m'] = nejblizsi_obec(q['lon'], q['lat'])

    # Pojistka proti neúplnému stažení
    if os.path.exists(VYSTUP):
        try:
            dosud = len(json.load(open(VYSTUP, encoding='utf-8'))['body'])
        except Exception:  # noqa: BLE001
            dosud = 0
        if dosud and len(prodejny) < dosud * 0.9:
            sys.exit(f'Jen {len(prodejny)} prodejen proti dosavadním {dosud}. Data vypadají neúplně, nic jsem nepřepsal.')
    if len(obce) < 5000:
        sys.exit(f'Jen {len(obce)} obcí. Export asi neobsahuje obce (place=city/town/village/suburb), nic jsem nepřepsal.')

    pocty = {r: sum(1 for q in prodejny if q['r'] == r) for r in RETEZCE}
    po_krajich = {}
    for q in prodejny:
        po_krajich.setdefault(q['kraj'], {r: 0 for r in RETEZCE})[q['r']] += 1
    formaty = sorted({q['f'] for q in prodejny if q['f']})
    prodejny.sort(key=lambda q: (q['lat'], q['lon']))
    stav = cas[:10] if cas else datetime.date.today().isoformat()

    vystup = {
        'stav': stav,
        'zdroj': 'OpenStreetMap (© přispěvatelé OpenStreetMap, ODbL), export přes Overpass',
        'retezce': [{'id': r, 'nazev': NAZVY[r], 'pocet': pocty[r]} for r in RETEZCE],
        'formaty': formaty,
        'kraje': po_krajich,
        # [lon, lat, index řetězce, index formátu (-1 = běžná prodejna), adresa, obec, otevírací doba, id v OSM]
        'body': [[round(q['lon'], 5), round(q['lat'], 5), RETEZCE.index(q['r']), formaty.index(q['f']) if q['f'] else -1,
                  q['a'], q['m'], q['o'], q['id']] for q in prodejny],
    }
    os.makedirs(os.path.dirname(VYSTUP), exist_ok=True)
    with open(VYSTUP, 'w', encoding='utf-8') as f:
        json.dump(vystup, f, ensure_ascii=False, separators=(',', ':'))
    aktualizuj_graf(pocty)

    for o in obce:
        o['k'] = poradi_kraju.index(kraj_bodu(o['lon'], o['lat']))
    obce.sort(key=lambda o: (o['t'], -o['pop'], o['n']))
    vystup_obce = {
        'stav': stav,
        'kraje': [k['nazev'] for k in json.load(open(os.path.join(KOREN, 'src', 'data', 'kraje.json'), encoding='utf-8'))['kraje']],
        # [název, lon, lat, typ (0 velké město, 1 město, 2 obec, 3 část obce), index kraje, u obce: nejbližší město, u části: její město]
        'obce': [[o['n'], round(o['lon'], 4), round(o['lat'], 4), o['t'], o['k'], o['u']] for o in obce],
    }
    with open(VYSTUP_OBCE, 'w', encoding='utf-8') as f:
        json.dump(vystup_obce, f, ensure_ascii=False, separators=(',', ':'))

    s_adresou = sum(1 for q in prodejny if q['a'])
    s_dobou = sum(1 for q in prodejny if q['o'])
    souhrn = [f'{len(prodejny)} prodejen (stav OpenStreetMap {stav}), {zdvojene} zdvojených záznamů sloučeno, {zavrene} zavřených vynecháno, {bez_znacky} bez rozpoznané značky',
              f'adresa u {s_adresou}, otevírací doba u {s_dobou} prodejen, {len(obce)} obcí a městských částí pro hledání']
    souhrn += [f'  {NAZVY[r]}: {pocty[r]}' for r in RETEZCE]
    print('\n'.join(souhrn))
    print(f'Uloženo do {VYSTUP} ({os.path.getsize(VYSTUP) // 1024} kB) a {VYSTUP_OBCE} ({os.path.getsize(VYSTUP_OBCE) // 1024} kB)')
    if os.environ.get('NAVRH_POPIS'):
        with open(os.environ['NAVRH_POPIS'], 'w', encoding='utf-8') as f:
            f.write('Čerstvá data prodejen z OpenStreetMap pro mapu supermarketů.\n\n```\n' + '\n'.join(souhrn) + '\n```\n\n'
                    'Po schválení (Merge) se mapa na webu sama aktualizuje.\n')
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a') as f:
            f.write(f'stav={stav}\n')


if __name__ == '__main__':
    main()
