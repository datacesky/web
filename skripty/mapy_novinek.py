"""Siluety map pro náhledy novinek: Česko, Evropa a glóbus (public/novinky/mapy/*.svg).

Na webu se používají jako masky (CSS mask-image), barvu jim dává web, takže sedí i v tmavém režimu.
Každá oblast má víc vrstev se stejným viewBoxem, aby na sebe přesně pasovaly:
  cesko.svg, cesko-kraje.svg                      Česko a hranice krajů (src/data/kraje.json)
  evropa.svg, evropa-hranice.svg, evropa-cz.svg   Evropa (Lambertova projekce), hranice států, Česko
  svet-koule.svg, svet.svg, svet-cz.svg           glóbus nad Evropou a Afrikou, pevnina, Česko

Spuštění (jen Python 3, nic dalšího): python3 skripty/mapy_novinek.py
Data: src/data/svet.json (TopoJSON, Natural Earth) a src/data/kraje.json. Stačí spustit, když se změní podklad.
"""
import json
import math
import re
from pathlib import Path

KOREN = Path(__file__).resolve().parent.parent
VYSTUP = KOREN / 'public' / 'novinky' / 'mapy'


def svg(viewbox, obsah):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}">{obsah}</svg>\n'


def uloz(nazev, text):
    VYSTUP.mkdir(parents=True, exist_ok=True)
    (VYSTUP / nazev).write_text(text, encoding='utf-8')
    print(f'{nazev}: {len(text) / 1024:.1f} kB')


# ---------- TopoJSON → polygony v zeměpisných souřadnicích ----------

def nacti_topo():
    t = json.loads((KOREN / 'src' / 'data' / 'svet.json').read_text(encoding='utf-8'))['topo']
    sx, sy = t['transform']['scale']
    tx, ty = t['transform']['translate']
    oblouky = []
    for a in t['arcs']:
        x = y = 0
        body = []
        for dx, dy in a:
            x += dx
            y += dy
            body.append((x * sx + tx, y * sy + ty))
        oblouky.append(body)

    def oblouk(i):
        return oblouky[i] if i >= 0 else oblouky[~i][::-1]

    def kruh(indexy):
        body = []
        for i in indexy:
            o = oblouk(i)
            body.extend(o if not body else o[1:])
        return body

    def objekt(nazev):
        out = {}
        for g in t['objects'][nazev]['geometries']:
            if g['type'] == 'Polygon':
                polygony = [g['arcs']]
            elif g['type'] == 'MultiPolygon':
                polygony = g['arcs']
            else:
                continue
            out[g.get('id') or f'_{len(out)}'] = [[kruh(k) for k in p] for p in polygony]
        return out

    zeme = objekt('countries')
    zeme['_pevnina'] = [p for v in objekt('land').values() for p in v]
    return zeme


def cesta(kruhy, proj, min_krok=0.6, okno=None):
    """Kruhy (seznam seznamů bodů) → SVG cesta; vynechá body blíž než min_krok.
    okno=(šířka, výška): body daleko za okrajem se přitáhnou k okraji, ať soubor nenese nic, co není vidět."""
    out = []
    for k in kruhy:
        pts = [proj(lon, lat) for lon, lat in k]
        pts = [p for p in pts if p is not None]
        if okno:
            W, H = okno
            pts = [(min(max(x, -20), W + 20), min(max(y, -20), H + 20)) for x, y in pts]
            if all(x in (-20, W + 20) or y in (-20, H + 20) for x, y in pts):
                continue
        if len(pts) < 3:
            continue
        hladke = [pts[0]]
        for p in pts[1:]:
            if math.dist(p, hladke[-1]) >= min_krok:
                hladke.append(p)
        if len(hladke) < 3:
            continue
        out.append('M' + 'L'.join(f'{x:.0f},{y:.0f}' for x, y in hladke) + 'Z')
    return ''.join(out)


# ---------- Česko ----------

def zjednodus(d, krok=2.5):
    """SVG cesta z kraje.json (jen M, L, Z) s body nejméně krok od sebe; na pozadí náhledu detail není potřeba."""
    kruhy = [[tuple(map(float, b)) for b in re.findall(r'(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)', kus)] for kus in re.findall(r'M[^M]+', d)]
    return cesta(kruhy, lambda x, y: (x, y), krok)


def cesko():
    kraje = json.loads((KOREN / 'src' / 'data' / 'kraje.json').read_text(encoding='utf-8'))['kraje']
    vb = '0 0 1000 578'
    d = [zjednodus(k['d']) for k in kraje]
    obrys = json.loads((KOREN / 'src' / 'data' / 'cesko-mapa.json').read_text(encoding='utf-8'))['obrys']
    uloz('cesko.svg', svg(vb, f'<path d="{zjednodus(obrys, 2)}"/>'))
    uloz('cesko-kraje.svg', svg(vb, f'<path d="{"".join(d)}" fill="none" stroke="#000" stroke-width="4" stroke-linejoin="round"/>'))


# ---------- Evropa: Lambertova azimutální projekce (jako EPSG:3035) ----------

def lambert(lon0, lat0, meritko, cx, cy):
    l0, f0 = math.radians(lon0), math.radians(lat0)

    def p(lon, lat):
        l, f = math.radians(lon), math.radians(lat)
        k = math.sqrt(2 / (1 + math.sin(f0) * math.sin(f) + math.cos(f0) * math.cos(f) * math.cos(l - l0)))
        x = k * math.cos(f) * math.sin(l - l0)
        y = k * (math.cos(f0) * math.sin(f) - math.sin(f0) * math.cos(f) * math.cos(l - l0))
        return cx + x * meritko, cy - y * meritko
    return p


def v_okne(kruhy, lon_od, lon_do, lat_od, lat_do):
    for k in kruhy:
        for lon, lat in k:
            if lon_od <= lon <= lon_do and lat_od <= lat <= lat_do:
                return True
    return False


def evropa(zeme):
    W, H = 640, 400  # 16 : 10 jako náhled
    # Česko trochu vpravo od středu, ať nad ním je místo pro ilustraci a Evropa je vidět celá
    proj = lambert(14, 52, 760, W * 0.66, H * 0.42)
    vb = f'0 0 {W} {H}'
    hranice = []
    for kod, polygony in zeme.items():
        if kod == '_pevnina':
            continue
        kruhy = [k for p in polygony for k in p]
        if not v_okne(kruhy, -30, 60, 25, 75):
            continue
        d = cesta(kruhy, proj, 1.4, (W, H))
        if d:
            hranice.append(d)
    pevnina = cesta([k for p in zeme['_pevnina'] for k in p if v_okne([k], -30, 70, 20, 80)], proj, 1.4, (W, H))
    uloz('evropa.svg', svg(vb, f'<path d="{pevnina}"/>'))
    uloz('evropa-hranice.svg', svg(vb, f'<path d="{"".join(hranice)}" fill="none" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/>'))
    cz = cesta([k for p in zeme['CZE'] for k in p], proj, 0.3)
    uloz('evropa-cz.svg', svg(vb, f'<path d="{cz}"/>'))


# ---------- Svět: ortografický glóbus ----------

def ortograf(lon0, lat0, r, cx, cy):
    l0, f0 = math.radians(lon0), math.radians(lat0)

    def p(lon, lat):
        l, f = math.radians(lon), math.radians(lat)
        cosc = math.sin(f0) * math.sin(f) + math.cos(f0) * math.cos(f) * math.cos(l - l0)
        x = math.cos(f) * math.sin(l - l0)
        y = math.cos(f0) * math.sin(f) - math.sin(f0) * math.cos(f) * math.cos(l - l0)
        if cosc < 0:
            # bod za obzorem přitáhneme na okraj glóbu, polygon tak skončí na obrysu koule
            d = math.hypot(x, y) or 1
            x, y = x / d, y / d
        return cx + x * r, cy - y * r
    return p


def svet(zeme):
    W, H = 440, 440
    R = 210
    proj = ortograf(15, 30, R, W / 2, H / 2)
    vb = f'0 0 {W} {H}'
    uloz('svet-koule.svg', svg(vb, f'<circle cx="{W / 2}" cy="{H / 2}" r="{R}"/>'))
    def vidi(k):
        # kruh úplně na odvrácené straně glóbu vynecháme
        return any(
            math.sin(math.radians(30)) * math.sin(math.radians(lat))
            + math.cos(math.radians(30)) * math.cos(math.radians(lat)) * math.cos(math.radians(lon - 15)) > 0
            for lon, lat in k[::3]
        )
    d = cesta([k for p in zeme['_pevnina'] for k in p if vidi(k)], proj, 1.6)
    uloz('svet.svg', svg(vb, f'<path d="{d}"/>'))
    cz = cesta([k for p in zeme['CZE'] for k in p], proj, 0.2)
    uloz('svet-cz.svg', svg(vb, f'<path d="{cz}"/>'))


if __name__ == '__main__':
    z = nacti_topo()
    cesko()
    evropa(z)
    svet(z)
