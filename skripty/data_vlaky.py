# -*- coding: utf-8 -*-
"""Vlaky za 24 hodin: z jízdního řádu Správy železnic (GTFS z projektu JrUtil) vyrobí public/data/vlaky.json.

Spuštění z kořene repozitáře (potřebuje pandas, numpy, networkx):
    curl -o /tmp/CZPTT_GTFS.zip https://data.jr.ggu.cz/results/2026-10-08/CZPTT_GTFS.zip
    unzip -o /tmp/CZPTT_GTFS.zip -d /tmp/czptt
    python3 skripty/data_vlaky.py /tmp/czptt

Co skript dělá:
- vezme spoje, které jedou v pondělí 5. 10. a v úterý 6. 10. 2026 (noční spoje z pondělka zasahují do úterka),
- vynechá služební vlaky (Sv) a nabídkové trasy, takže za úterý vyjde 9 143 vlaků jako ve videu,
- ze zastávkových vlaků (Os, TL) poskládá síť tratí a rychlíky a expresy vede po ní, přes stanice, kde nestaví,
- časy mezi zastávkami dopočte podle vzdálenosti, ujeté km jsou proto odhad,
- zahraniční zastávky v datech nemají souřadnice, vlaky se proto ukazují jen na českém území.
"""
import collections, json, math, os, re, sys

import networkx as nx
import numpy as np
import pandas as pd

G_DIR = sys.argv[1] if len(sys.argv) > 1 else '/tmp/czptt'
KOREN = os.path.join(os.path.dirname(__file__), '..')
DNY = ['20261005', '20261006']
DALKOVE = {'R', 'EC', 'IC', 'RJ', 'rj', 'LE', 'SC', 'EN', 'ES', 'NJ', 'TLX', 'Ex'}
SKUPINY = ['České dráhy', 'Arriva', 'RegioJet', 'GW Train', 'Die Länderbahn', 'Leo Express', 'Ostatní']


def skupina(a):
    for i, z in enumerate(['České dráhy', 'ARRIVA', 'RegioJet', 'GW Train', 'Die Länderbahn', 'Leo Express']):
        if a.startswith(z):
            return i
    return 6


def minuty(s):
    h, m, x = s.split(':')
    return int(h) * 60 + int(m) + int(x) / 60


def jmeno(n):
    # „ z" na konci je v CIS JŘ značka zastávky na znamení, „Pha-" zkratka Prahy
    n = re.sub(r' z$', '', n)
    return re.sub(r'^Pha-', 'Praha-', n)


# --- 1. spoje v pondělí a úterý
cd = pd.read_csv(f'{G_DIR}/calendar_dates.txt', dtype=str, usecols=['service_id', 'date', 'exception_type'])
cd = cd[cd.date.isin(DNY) & (cd.exception_type == '1')]
t = pd.read_csv(f'{G_DIR}/trips.txt', dtype=str, usecols=['route_id', 'service_id', 'trip_id', 'trip_headsign']).merge(cd[['service_id', 'date']], on='service_id')
t = t.merge(pd.read_csv(f'{G_DIR}/routes.txt', dtype=str, usecols=['route_id', 'agency_id', 'route_short_name']), on='route_id', how='left')
t = t.merge(pd.read_csv(f'{G_DIR}/agency.txt', dtype=str)[['agency_id', 'agency_name']], on='agency_id', how='left')
t['druh'] = t.route_short_name.str.split(' ').str[0]
t = t[(t.druh != 'Sv') & (t.agency_name != 'nabídková trasa')].copy()
t['dalkovy'] = t.druh.isin(DALKOVE)
ids = set(t.trip_id)
st = pd.concat(ch[ch.trip_id.isin(ids)] for ch in pd.read_csv(f'{G_DIR}/stop_times.txt', dtype=str, chunksize=2_000_000,
               usecols=['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence', 'pickup_type']))
st['arr'] = st.arrival_time.map(minuty); st['dep'] = st.departure_time.map(minuty)
st['seq'] = st.stop_sequence.astype(int)
st = st.sort_values(['trip_id', 'seq'])
t['t0'] = t.trip_id.map(st.groupby('trip_id').dep.first())
t['off'] = np.where(t.date == DNY[0], -1440, 0)
t['s0'] = t.t0 + t.off  # první odjezd spoje (i v zahraničí) v minutách úterka

# --- 2. stanice a síť
s = pd.read_csv(f'{G_DIR}/stops.txt', dtype=str)
s['lat'] = s.stop_lat.astype(float); s['lon'] = s.stop_lon.astype(float)
rodic = {r.stop_id: (r.parent_station if isinstance(r.parent_station, str) and r.parent_station else r.stop_id) for r in s.itertuples()}
info = s.set_index('stop_id')
st = st[st.stop_id.str.contains('-CZ-')].copy()  # zahraniční zastávky nemají souřadnice
st['uzel'] = st.stop_id.map(rodic)
LL = {u: (float(info.loc[u].lat), float(info.loc[u].lon)) for u in st.uzel.unique()}
JM = {u: jmeno(info.loc[u].stop_name) for u in LL}


def km(a, b):
    (la1, lo1), (la2, lo2) = LL[a], LL[b]
    p = math.pi / 180
    q = math.sin((la2 - la1) * p / 2) ** 2 + math.cos(la1 * p) * math.cos(la2 * p) * math.sin((lo2 - lo1) * p / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(q))


zastavky = {k: g for k, g in st.groupby('trip_id', sort=False)}
G = nx.Graph()
for tid in t[t.druh.isin(['Os', 'TL'])].trip_id.unique():
    u = list(zastavky[tid].uzel.values)
    for a, b in zip(u, u[1:]):
        if a != b:
            G.add_edge(a, b, w=km(a, b))
cache = {}


def trasa(a, b):
    if (a, b) in cache:
        return cache[(a, b)]
    res = [a, b]
    if G.has_node(a) and G.has_node(b) and not G.has_edge(a, b):
        try:
            p = nx.shortest_path(G, a, b, weight='w')
            if sum(km(x, y) for x, y in zip(p, p[1:])) <= 1.6 * km(a, b) + 5:
                res = p
        except nx.NetworkXNoPath:
            pass
    cache[(a, b)] = res; cache[(b, a)] = res[::-1]
    return res


# --- 3. průjezd každého spoje: (uzel, čas, odjíždí odtud cestující?)
hrany, prujezdy = set(), {}
for tid in t.trip_id.unique():
    if tid not in zastavky:
        continue
    g = zastavky[tid]
    u, arr, dep, pick = g.uzel.values, g.arr.values, g.dep.values, g.pickup_type.values
    body = []
    for i in range(len(u)):
        if i > 0:
            p = trasa(u[i - 1], u[i])
            if len(p) > 2:
                d = np.cumsum([0] + [km(x, y) for x, y in zip(p, p[1:])])
                for j in range(1, len(p) - 1):
                    body.append((p[j], dep[i - 1] + (arr[i] - dep[i - 1]) * d[j] / d[-1], 0))
            for x, y in zip(p, p[1:]):
                hrany.add(tuple(sorted((x, y))))
        odjezd = 1 if (i < len(u) - 1 and pick[i] != '1') else 0
        body.append((u[i], arr[i], 0 if dep[i] > arr[i] else odjezd))
        if dep[i] > arr[i]:
            body.append((u[i], dep[i], odjezd))
    prujezdy[tid] = body
t = t[t.trip_id.isin(prujezdy)]

# --- 4. data pro web
P = json.load(open(os.path.join(KOREN, 'src', 'data', 'cesko-mapa.json')))['projekce']


def xy(u):
    la, lo = LL[u]
    return (P['k'] * math.radians(lo) + P['tx'], P['ty'] - P['k'] * math.log(math.tan(math.pi / 4 + math.radians(la) / 2)))


pouzite = sorted({u for b in prujezdy.values() for (u, c, o) in b} | {u for e in hrany for u in e})
idx = {u: i for i, u in enumerate(pouzite)}
cile, cil_i, spoje = [], {}, []
beh = np.zeros((7, 1440), np.int32); odj = np.zeros((7, 1440), np.int32); kmm = np.zeros((7, 1440))
provoz = collections.Counter()
konec_minuty = np.arange(1440) + 1
for r in t.itertuples():
    b = prujezdy[r.trip_id]
    a0, a1 = b[0][1] + r.off, b[-1][1] + r.off
    g = skupina(r.agency_name)
    if 0 <= r.s0 < 1440:
        odj[g, int(r.s0):] += 1
        for x, y in zip(b, b[1:]):
            if x[0] != y[0]:
                provoz[tuple(sorted((x[0], y[0])))] += 1
    if a1 < 0 or a0 > 1440:
        continue
    i0, i1 = max(0, math.ceil(a0)), min(1439, math.floor(a1))
    if i1 >= i0:
        beh[g, i0:i1 + 1] += 1
    for x, y in zip(b, b[1:]):
        c0, c1 = x[1] + r.off, y[1] + r.off
        if x[0] == y[0] or c1 <= max(0, c0) or c0 >= 1440:
            continue
        kmm[g] += km(x[0], y[0]) * (np.clip((konec_minuty - c0) / (c1 - c0), 0, 1) - np.clip(-c0 / (c1 - c0), 0, 1))
    hs = r.trip_headsign if isinstance(r.trip_headsign, str) else ''
    if hs not in cil_i:
        cil_i[hs] = len(cile); cile.append(hs)
    prev = t0 = round((b[0][1] + r.off) * 10)
    uzly, casy = [], []
    for (u, c, o) in b:
        cc = round((c + r.off) * 10)
        uzly.append(idx[u] * 4 + (2 if o else 0)); casy.append(cc - prev); prev = cc
    spoje.append([g, (1 if r.dalkovy else 0) | (2 if 0 <= r.s0 < 1440 else 0), r.route_short_name, cil_i[hs], t0, uzly, casy])

sit = ['', '', '']
for (a, c) in sorted(hrany):
    n = provoz.get((a, c), 0)
    (x1, y1), (x2, y2) = xy(a), xy(c)
    sit[2 if n >= 60 else 1 if n >= 20 else 0] += f'M{x1:.1f} {y1:.1f}L{x2:.1f} {y2:.1f}'

out = dict(
    den='2026-10-06', zdroj='Jízdní řád Správy železnic (CIS JŘ), převod do GTFS projektem JrUtil, stav k 8. 10. 2026',
    skupiny=SKUPINY, uzly=[[round(xy(u)[0], 1), round(xy(u)[1], 1)] for u in pouzite], jmena=[JM[u] for u in pouzite],
    cile=cile, sit=sit, spoje=spoje, beh=beh.tolist(), odj=odj.tolist(), km=[[round(v) for v in row] for row in kmm.tolist()],
)
cil = os.path.join(KOREN, 'public', 'data', 'vlaky.json')
with open(cil, 'w') as f:
    f.write(json.dumps(out, ensure_ascii=False, separators=(',', ':')).replace('],[', '],\n['))  # zalomení kvůli diffům
b = beh.sum(axis=0)
print('vlaků v úterý:', int(odj[:, -1].sum()), dict(zip(SKUPINY, odj[:, -1].tolist())))
print('dálkové:', int(t[(t.s0 >= 0) & (t.s0 < 1440)].dalkovy.sum()), '· špička', int(b.max()), f'v {int(b.argmax()) // 60}:{int(b.argmax()) % 60:02d}', '· km', round(float(kmm.sum(axis=0)[-1])))
print('soubor', cil, os.path.getsize(cil) // 1024, 'kB')
