# -*- coding: utf-8 -*-
"""Vyrobí src/data/capi.json pro mapu Cesta čápů (stránka Svět) ze zamčených dat v capi_data.py.

Spuštění z kořene repozitáře:  python3 skripty/data_capi.py
Každý pták má body trasy s polohou a dnem sezóny (0 = 1. srpna, 302 = 31. května).
Body bez data (pomocné body tvaru trasy) dostanou čas dopočtený podle vzdálenosti mezi sousedními datovanými body.
29. únor se v přestupných letech nepočítá, aby šly všechny sezóny 1995–2021 do jednoho kalendáře.
"""
import json, math, os, sys
from datetime import date

sys.path.insert(0, os.path.dirname(__file__))
import capi_data as C

KONEC = {'home': 'domov', 'lost': 'ztracen', 'died': 'uhynul', 'estimate': 'ztracen'}
STRANA = {'ZÁPADNÍ TRASA': 'zapad', 'VÝCHODNÍ TRASA': 'vychod'}


def den(s, y0):
    d = date.fromisoformat(s)
    n = (d - date(y0, 8, 1)).days
    y1 = y0 + 1
    if y1 % 4 == 0 and d >= date(y1, 3, 1):  # 29. únor vynecháme
        n -= 1
    return n


def km(a, b):
    p = math.pi / 180
    q = math.sin((b['lat'] - a['lat']) * p / 2) ** 2 + math.cos(a['lat'] * p) * math.cos(b['lat'] * p) * math.sin((b['lon'] - a['lon']) * p / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(q))


def datum_text(s):
    d = date.fromisoformat(s)
    return f'{d.day}. {d.month}. {d.year}'


ptaci = []
for b in C.BIRDS:
    y0 = b['y0']
    pts = b['pts']
    casy = [den(p['date'] or p['tdate'], y0) if (p['date'] or p['tdate']) else None for p in pts]
    # dopočet časů pomocných bodů podle vzdálenosti
    i = 0
    while i < len(pts):
        if casy[i] is None:
            a = i - 1
            j = i
            while casy[j] is None:
                j += 1
            useky = [km(pts[k], pts[k + 1]) for k in range(a, j)]
            celkem = sum(useky) or 1
            s = 0
            for k in range(a + 1, j):
                s += useky[k - a - 1]
                casy[k] = casy[a] + (casy[j] - casy[a]) * s / celkem
            i = j
        i += 1
    body = []
    for p, t in zip(pts, casy):
        body.append(dict(
            lat=p['lat'], lon=p['lon'], d=round(t, 2), f=p['kind'] == 'fix' and bool(p['date']),
            faze=p['phase'], gap=bool(p['gap']), nazev=p['label'],
            datum=p['show'] or (datum_text(p['date']) if p['date'] else ''),
            a2=p['cc'][0] if p['cc'] else '',
        ))
    zimoviste = []
    for p in pts:
        if p['cc'] and p['cc'][1] not in zimoviste:
            zimoviste.append(p['cc'][1])
    ptaci.append(dict(
        klic=b['key'], jmeno=b['name'], druh=b['species'], sezona=b['season'], domov=b['home'],
        strana='odhad' if b.get('estimate') else STRANA.get(b['side'], 'zapad'),
        konec=KONEC[b['end']], odhad=bool(b.get('estimate')),
        nezname=[[den(a, y0), den(z, y0)] for a, z in b.get('unknown', [])],
        zimoviste=[{'SENEGAL': 'Senegal', 'GUINEA': 'Guinea', 'POBŘEŽÍ SLONOVINY': 'Pobřeží slonoviny', 'ČAD': 'Čad',
                    'STŘEDOAFRICKÁ REPUBLIKA': 'Středoafrická republika', 'ETIOPIE': 'Etiopie', 'MALI': 'Mali',
                    'ŠPANĚLSKO': 'Španělsko', 'NIGÉRIE': 'Nigérie'}.get(z, z.capitalize()) for z in zimoviste],
        body=body,
    ))

out = dict(
    zdroj='Bobek et al. (2008), Journal of Avian Biology; deník projektu Africká odysea (Český rozhlas 1995–99); Záchranná stanice živočichů Plzeň (2020–21)',
    pozn='Sezóny 1995–2021 v jednom kalendáři od srpna do května. Trasy mezi zaznamenanými polohami jsou zjednodušené.',
    ptaci=ptaci,
)
cil = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'capi.json')
json.dump(out, open(cil, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for p in ptaci:
    print(p['jmeno'], p['strana'], p['konec'], 'dny', p['body'][0]['d'], '→', p['body'][-1]['d'], p['zimoviste'])
