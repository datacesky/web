# -*- coding: utf-8 -*-
"""Zamčená data k reelu „Kam letí čeští čápi na zimu" (@data.cesky, 13. 10. 2026) a k mapě Cesta čápů na datacesky.cz/svet/.
Body jsou převzaté beze změny z podkladů videa. Z tohoto souboru vyrábí skripty/data_capi.py soubor src/data/capi.json.
"""

# ----- čápi 1995/96 a 2019–21 (podklad v2) -----
"""DATA LOCK v2 — Kam letí čeští čápi na zimu (a jak se vracejí)  @data.cesky

Bod P(...):
  date  = skutečné datum polohy ze zdroje (zobrazuje se)
  tdate = jen pro časování animace (nezobrazuje se) – odhad, kdy pták místo opustil apod.
  kind  = "fix" (poloha doložená ve zdroji) / "via" (pomocný bod tvaru čáry)
  phase = "out" (na zimu) / "winter" (pohyb na zimovišti) / "back" (návrat)
  gap   = úsek PŘED tímto bodem je bez signálu vysílačky (kreslí se čárkovaně)
  cc    = (iso, název státu) pro kartu zimoviště

Zdroje:
 [A] Bobek M., Hampl R., Peške L., Pojer F., Šimek J., Bureš S. (2008): African Odyssey
     project – satellite tracking of black storks Ciconia nigra breeding at a migratory
     divide. Journal of Avian Biology 39: 500–506.
 [B] Český rozhlas – deník projektu Africká odysea, www2.rozhlas.cz/capi/en/
     9508, 9509, 9510, 9511, 9512 (1995) a 9601, 9602, 9603, 9604, 9605 (1996)
 [C] ČTK / Novinky.cz 5. 4. 2021 – Na západ Čech se vrací čáp Kryštof (ZS Plzeň, K. Makoň)
 [D] Seznam Zprávy 20. 4. 2021 – Kryštof je samice; do Polžic přiletěl „minulé úterý“ (= 13. 4.)
 [E] Novinky.cz 25. 7. 2020 – Míra je mrtev, ať žije Míra (ZS Plzeň): Míra I doletěl
     „až pod horu Kilimandžáro“, poslední signál 8. 3. 2020; trasa NEZNÁMÁ → celá jako odhad
"""


def P(lat, lon, label, date=None, kind="fix", phase="out", gap=False, show=None, tdate=None, cc=None):
    return dict(lat=lat, lon=lon, label=label, date=date, kind=kind, phase=phase, gap=gap,
                show=show, tdate=tdate, cc=cc)


SN = ("sn", "SENEGAL")
GN = ("gn", "GUINEA")
CI = ("ci", "POBŘEŽÍ SLONOVINY")
TD = ("td", "ČAD")
CF = ("cf", "STŘEDOAFRICKÁ REPUBLIKA")
ET = ("et", "ETIOPIE")

BIRDS = [
    dict(
        key="kristyna", name="Kristýna", species="čáp černý", season="1995/96", y0=1995,
        side="ZÁPADNÍ TRASA", home="Brdy", src="A, B", estimate=False,
        unknown=[],
        pts=[
            P(49.75, 13.85, "Brdy", "1995-09-14"),
            P(47.98, 8.82, "Tuttlingen, Německo", "1995-09-17"),
            P(37.05, -3.30, "Sierra Nevada, Španělsko", "1995-09-26"),
            P(36.00, -5.60, "Gibraltar", "1995-09-27"),
            P(31.10, -7.90, "Vysoký Atlas, Maroko", "1995-09-29"),
            P(29.60, -6.00, "údolí Oued Drâa, Maroko", "1995-10-02"),
            P(16.20, -12.50, "jižní Mauritánie", "1995-10-11"),
            P(13.40, -12.00, "řeka Falémé, Senegal", "1995-10-13", phase="winter", cc=SN),
            P(13.40, -12.00, "řeka Falémé, Senegal", "1996-01-01", phase="winter", cc=SN),
            P(13.40, -12.00, "řeka Falémé, Senegal", tdate="1996-02-15", kind="via", phase="winter", cc=SN),
            P(10.40, -10.80, "vnitrozemí Guineje", "1996-02-21", phase="winter", cc=GN),
            P(9.00, -3.80, "NP Comoé, Pobřeží slonoviny", "1996-02-26", phase="winter", cc=CI),
            P(9.00, -3.80, "NP Comoé, Pobřeží slonoviny", tdate="1996-03-14", kind="via", phase="winter", cc=CI),
            P(14.50, -4.50, "Mali", "1996-03-17", phase="back"),
            P(29.60, -6.00, "údolí Oued Drâa, Maroko", "1996-03-25", phase="back"),
            P(36.00, -5.60, "Gibraltar", kind="via", phase="back", gap=True),
            P(42.60, 1.00, "Pyreneje", kind="via", phase="back", gap=True),
            P(47.60, 8.60, "Německo", kind="via", phase="back", gap=True),
            P(49.75, 13.85, "Brdy – zpět na hnízdě", "1996-04-13", phase="back", gap=True),
        ],
    ),
    dict(
        key="krystof", name="Kryštof", species="čáp bílý", season="2020/21", y0=2020,
        side="ZÁPADNÍ TRASA", home="Polžice", src="C, D", estimate=False,
        # časy bez přesných dat (polohy podle zemí ze zdroje, data neuvedena)
        unknown=[("2020-08-01", "2020-10-31"), ("2021-03-01", "2021-04-04")],
        pts=[
            P(49.70, 13.10, "Plzeňsko", tdate="2020-08-10", kind="fix"),
            P(48.40, 8.20, "Německo", kind="via"),
            P(45.80, 2.30, "Francie", kind="via"),
            P(40.42, -3.70, "Madrid, Španělsko"),
            P(36.00, -5.60, "Gibraltar"),
            P(32.50, -7.50, "Maroko", kind="via"),
            P(27.20, -13.20, "pobřeží Atlantiku", kind="via"),
            P(19.50, -12.80, "Mauritánie", kind="via"),
            P(15.40, -12.30, "hranice Mali a Mauritánie", kind="via"),
            P(14.85, -15.88, "okolí města Touba, Senegal", tdate="2020-10-01", phase="winter", cc=SN),
            P(14.85, -15.88, "okolí města Touba, Senegal", tdate="2021-03-15", kind="via", phase="winter", cc=SN),
            P(20.50, -15.50, "Mauritánie", kind="via", phase="back"),
            P(30.50, -9.00, "Maroko", kind="via", phase="back"),
            P(36.00, -5.60, "Gibraltar", "2021-04-04", phase="back"),
            P(40.20, -3.40, "Španělsko", kind="via", phase="back"),
            P(45.80, 2.60, "Francie", kind="via", phase="back"),
            P(48.70, 9.30, "Německo", kind="via", phase="back"),
            P(49.50, 13.00, "Polžice – zpět doma", "2021-04-13", phase="back"),
        ],
    ),
    dict(
        key="viktor", name="Viktor", species="čáp černý", season="1995/96", y0=1995,
        side="VÝCHODNÍ TRASA", home="Rakovnicko", src="A, B", estimate=False,
        unknown=[],
        pts=[
            P(50.10, 13.73, "Rakovnicko", tdate="1995-08-30"),
            P(49.50, 15.60, "Vysočina", "1995-08-30"),
            P(48.56, 16.08, "Hollabrunn, Rakousko", "1995-09-01"),
            P(47.65, 17.60, "řeka Rába, Maďarsko", "1995-09-06"),
            P(47.65, 17.60, "Malá uherská nížina, Maďarsko", "1995-09-14"),
            P(46.20, 21.30, "západní Rumunsko", "1995-09-26"),
            P(40.20, 26.40, "Dardanely, Turecko", "1995-10-02"),
            P(38.60, 31.50, "Turecko", kind="via"),
            P(36.60, 36.20, "Turecko", kind="via"),
            P(32.62, 35.55, "Gesher, Izrael", "1995-10-13"),
            P(29.60, 32.70, "Suezský záliv, Egypt", "1995-10-19"),
            P(12.40, 21.90, "jihovýchodní Čad", "1995-10-26", phase="winter", cc=TD),
            P(12.22, 21.41, "Goz Beida, Čad", "1995-11-20", phase="winter", cc=TD),
            P(8.40, 21.90, "Středoafrická republika", "1995-12-18", phase="winter", cc=CF),
            P(7.90, 22.60, "povodí řeky Kotto, SAR", "1996-01-01", phase="winter", cc=CF),
            P(7.90, 22.60, "povodí řeky Kotto, SAR", tdate="1996-03-12", kind="via", phase="winter", cc=CF),
            P(13.00, 24.50, "západní Súdán", "1996-03-16", phase="back"),
            P(18.50, 35.00, "severovýchodní Súdán", "1996-03-22", phase="back"),
            P(29.60, 32.70, "Egypt", kind="via", phase="back", gap=True),
            P(32.60, 35.50, "Izrael", kind="via", phase="back", gap=True),
            P(37.20, 35.60, "Turecko", kind="via", phase="back", gap=True),
            P(40.80, 29.50, "Turecko", kind="via", phase="back", gap=True),
            P(44.80, 22.00, "Balkán", kind="via", phase="back", gap=True),
            P(48.00, 17.80, "Slovensko", kind="via", phase="back", gap=True),
            P(50.10, 13.73, "Rakovnicko – zpět doma", "1996-05-21", phase="back", gap=True),
        ],
    ),
    dict(
        key="zuzana", name="Zuzana", species="čáp černý", season="1995/96", y0=1995,
        side="VÝCHODNÍ TRASA", home="Rakovnicko", src="A, B", estimate=False,
        unknown=[],
        pts=[
            P(50.02, 13.45, "Rakovnicko", tdate="1995-08-27"),
            P(47.20, 17.00, "západní Maďarsko", "1995-09-01"),
            P(46.20, 21.40, "západní Rumunsko", "1995-09-14"),
            P(46.20, 21.40, "západní Rumunsko", tdate="1995-09-30", kind="via"),
            P(44.60, 21.20, "Srbsko", "1995-10-15"),
            P(42.20, 26.60, "jihovýchodní Bulharsko", "1995-10-20"),
            P(41.10, 29.05, "Bospor", "1995-10-22"),
            P(39.00, 32.50, "Turecko", "1995-10-29"),
            P(36.60, 36.20, "Turecko", kind="via"),
            P(33.18, 35.63, "kibuc Amir, Izrael", "1995-11-21"),
            P(29.60, 32.60, "Suezský záliv, Egypt", "1995-11-26"),
            P(12.00, 37.30, "jezero Tana, Etiopie", "1995-12-04", phase="winter", cc=ET),
            P(11.80, 38.00, "východně od jezera Tana", "1995-12-22", phase="winter", cc=ET),
            P(11.80, 38.00, "odlet ze zimoviště", "1996-03-24", phase="winter", cc=ET),
            P(23.50, 33.80, "jihovýchodní Egypt", "1996-03-31", phase="back"),
            P(29.60, 32.60, "Suezský záliv, Egypt", "1996-04-01", phase="back"),
            P(29.90, 33.70, "Sinaj", "1996-04-02", phase="back"),
            P(32.46, 35.56, "Kfar Ruppin, Izrael", "1996-04-04", phase="back"),
            P(32.46, 35.56, "Izrael", "1996-04-09", phase="back"),
            P(36.60, 36.20, "Turecko", kind="via", phase="back"),
            P(39.40, 32.20, "Turecko", kind="via", phase="back"),
            P(40.60, 30.00, "severozápadní Turecko", phase="back"),
            P(41.10, 29.05, "Bospor", show="26.–28. 4. 1996", tdate="1996-04-27", phase="back"),
            P(43.80, 21.00, "bývalá Jugoslávie", phase="back"),
            P(48.00, 19.80, "severní Maďarsko", "1996-05-07", phase="back"),
            P(50.02, 13.45, "Rakovnicko – zpět doma", "1996-05-28", phase="back"),
        ],
    ),
    dict(
        key="mira", name="Míra", species="čáp bílý", season="2019/20", y0=2019,
        side="TRASA JE ODHAD", home="Tachovsko", src="E", estimate=True,
        unknown=[("2019-08-01", "2020-03-08")],
        pts=[
            P(49.80, 12.63, "Tachovsko", tdate="2019-08-25"),
            P(48.20, 16.40, "Rakousko", kind="via"),
            P(46.50, 20.00, "Maďarsko", kind="via"),
            P(42.80, 25.50, "Bulharsko", kind="via"),
            P(41.10, 29.05, "Bospor", kind="via"),
            P(38.80, 33.50, "Turecko", kind="via"),
            P(36.60, 36.20, "Turecko", kind="via"),
            P(32.50, 35.40, "Izrael", kind="via"),
            P(29.80, 32.70, "Sinaj", kind="via"),
            P(23.50, 32.90, "Egypt", kind="via"),
            P(15.50, 33.00, "Súdán", kind="via"),
            P(8.50, 31.70, "Jižní Súdán", kind="via"),
            P(2.50, 36.20, "Keňa", kind="via"),
            P(-3.07, 37.35, "pod Kilimandžárem", tdate="2019-12-01", phase="winter"),
            P(-3.07, 37.35, "pod Kilimandžárem", "2020-03-08", phase="winter"),
        ],
    ),
]

SOURCE_1 = "Zdroj: Bobek et al. 2008 · deník Africké odysey (ČRo 1995–96) · ZS Plzeň 2020–21"
SOURCE_2 = "Mezi polohami trasy zjednodušené · vzdálenosti: vlastní výpočet"



# ----- další čápi z Africké odysey 1997–99 (podklad v3) -----

B2 = BIRDS

ML = ("ml", "MALI")
ES = ("es", "ŠPANĚLSKO")
NG = ("ng", "NIGÉRIE")

EXTRA = [
    dict(
        key="martin", name="Martin", species="čáp černý", season="1997/98", y0=1997,
        side="ZÁPADNÍ TRASA", home="Dobříš", src="F", estimate=False, end="home", unknown=[],
        pts=[
            P(50.03, 15.20, "Kolín", "1997-09-11"),
            P(48.60, 9.50, "Německo", kind="via"),
            P(43.60, 1.40, "jižní Francie", "1997-10-04"),
            P(40.50, -3.00, "Španělsko", kind="via"),
            P(36.00, -5.60, "Gibraltar", "1997-10-14"),
            P(31.10, -7.90, "Vysoký Atlas, Maroko", "1997-10-15"),
            P(13.50, -6.90, "u Bamaka, Mali", "1997-10-24", phase="winter", cc=ML),
            P(14.00, -5.50, "mokřady u Nigeru, Mali", "1997-11-17", phase="winter", cc=ML),
            P(14.50, -4.60, "vnitrozemská delta Nigeru", "1997-12-29", phase="winter", cc=ML),
            P(14.50, -4.20, "delta Nigeru u Mopti", "1998-02-14", phase="winter", cc=ML),
            P(14.50, -4.20, "delta Nigeru u Mopti", tdate="1998-03-05", kind="via", phase="winter", cc=ML),
            P(17.80, -9.30, "východní Mauritánie", "1998-03-10", phase="back"),
            P(33.50, -6.00, "za Vysokým Atlasem, Maroko", "1998-03-16", phase="back"),
            P(36.00, -5.60, "Gibraltar", "1998-03-17", phase="back"),
            P(40.90, -3.00, "severovýchodně od Madridu", "1998-03-21", phase="back"),
            P(42.80, 1.50, "Pyreneje", kind="via", phase="back", gap=True),
            P(46.50, 5.50, "Francie", kind="via", phase="back", gap=True),
            P(48.80, 10.50, "Německo", kind="via", phase="back", gap=True),
            P(49.78, 14.17, "Dobříš – zpět doma", "1998-04-04", phase="back", gap=True),
        ],
    ),
    dict(
        key="jakub", name="Jakub", species="čáp černý", season="1997/98", y0=1997,
        side="VÝCHODNÍ TRASA", home="Rokycansko", src="F, H", estimate=False, end="lost", unknown=[],
        pts=[
            P(49.74, 13.60, "Rokycansko", "1997-09-05"),
            P(49.45, 11.08, "Norimberk, Německo", "1997-09-13"),
            P(47.70, 17.20, "severozápadní Maďarsko", "1997-09-18"),
            P(45.30, 16.40, "povodí Sávy, Chorvatsko", tdate="1997-09-19"),
            P(41.00, 28.00, "Turecko", kind="via"),
            P(38.50, 33.00, "Turecko", kind="via"),
            P(36.60, 36.20, "Turecko", kind="via"),
            P(32.90, 35.50, "severní Izrael", "1997-10-04"),
            P(32.65, 35.25, "Ginegar, Izrael", "1997-10-07"),
            P(27.20, 31.20, "Asjút, Egypt", "1997-10-15"),
            P(13.00, 19.50, "Čad", "1997-10-24"),
            P(9.60, 8.50, "střední Nigérie", "1997-11-05", phase="winter", cc=NG),
            P(9.60, 8.50, "střední Nigérie", "1997-11-17", phase="winter", cc=NG),
        ],
    ),
    dict(
        key="tereza", name="Tereza", species="čáp černý", season="1997/98", y0=1997,
        side="ZÁPADNÍ TRASA", home="střední Čechy", src="F, H", estimate=False, end="died", unknown=[],
        pts=[
            P(49.78, 14.17, "střední Čechy", tdate="1997-09-06"),
            P(47.08, 2.40, "Bourges, Francie", "1997-09-11"),
            P(39.50, -4.00, "Španělsko", "1997-10-04"),
            P(36.00, -5.60, "Gibraltar", "1997-10-06"),
            P(30.00, -8.50, "Antiatlas, Maroko", "1997-10-12"),
        ],
    ),
    dict(
        key="david", name="David", species="čáp černý", season="1998/99", y0=1998,
        side="ZÁPADNÍ TRASA", home="Brdy", src="G", estimate=False, end="home", unknown=[],
        pts=[
            P(49.75, 13.85, "Brdy", "1998-09-18"),
            P(48.30, 8.80, "jihozápadní Německo", "1998-09-19"),
            P(46.90, 6.20, "pohoří Jura, Francie", "1998-09-20"),
            P(43.00, -0.80, "západní Pyreneje", "1998-09-24"),
            P(43.00, -0.80, "západní Pyreneje", "1998-09-30"),
            P(37.00, -6.40, "Doñana, Španělsko", "1998-10-10", phase="winter", cc=ES),
            P(37.00, -6.40, "delta Guadalquiviru", "1999-02-27", phase="winter", cc=ES),
            P(37.00, -6.40, "delta Guadalquiviru", tdate="1999-03-02", kind="via", phase="winter", cc=ES),
            P(39.00, -4.00, "vnitrozemí Španělska", "1999-03-04", phase="back"),
            P(41.80, -1.30, "údolí Ebra u Zaragozy", "1999-03-05", phase="back"),
            P(44.45, 1.44, "Cahors, Francie", "1999-03-10", phase="back"),
            P(47.00, 6.00, "východní Francie", "1999-03-12", phase="back"),
            P(48.15, 11.60, "Mnichov, Německo", "1999-03-14", phase="back"),
            P(49.75, 13.85, "Brdy – zpět doma", "1999-03-18", phase="back"),
        ],
    ),
]

END = dict(kristyna="home", krystof="home", viktor="home", zuzana="home", mira="estimate")
import copy
BASE = []
for b in B2:
    b = copy.deepcopy(b)
    b["end"] = END[b["key"]]
    if b["key"] == "krystof":
        # data cesty na zimu nejsou zveřejněna; „odletěl koncem léta" -> časování odhadem (stejně jako ve videu)
        b["pts"][0]["tdate"] = "2020-08-25"
        b["pts"][9]["tdate"] = "2020-09-28"
    BASE.append(b)

ORDER = ["kristyna", "viktor", "zuzana", "martin", "jakub", "tereza", "david", "mira", "krystof"]
_all = {b["key"]: b for b in BASE + EXTRA}
BIRDS = [_all[k] for k in ORDER]

# štítky zemí na mapě: (iso, název, kotva lat/lon, posun px (dx, dy), kdo/odkdy = klíč ptáka a index bodu)
PILLS = [
    ("sn", "Senegal", (14.2, -14.0), (-150, 0), [("kristyna", 7), ("krystof", 9)]),
    ("ml", "Mali", (14.4, -4.4), (12, 46), [("martin", 6)]),
    ("es", "Španělsko", (37.0, -6.4), (-150, 6), [("david", 5)]),
    ("td", "Čad", (12.3, 21.6), (106, -10), [("viktor", 11)]),
    ("cf", "SAR", (7.9, 22.6), (90, 30), [("viktor", 13)]),
    ("ng", "Nigérie", (9.6, 8.5), (-118, 34), [("jakub", 11)]),
    ("et", "Etiopie", (11.9, 37.6), (118, 6), [("zuzana", 11)]),
]

SOURCE_1 = "Zdroj: Bobek et al. 2008 · deník Africké odysey (ČRo 1995–99) · ZS Plzeň 2020–21"
SOURCE_2 = "Sezóny 1995–2021 v jednom kalendáři · trasy mezi polohami zjednodušené"

