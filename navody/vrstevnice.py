"""Vygeneruje jemné vrstevnice (topo linky) jako SVG, ve stylu titulních slidů @data.cesky.

Pozadí úvodu webu je public/vrstevnice.svg, vzniklo takhle:
    python3 navody/vrstevnice.py "#D6CCB9" 12 > public/vrstevnice.svg
Jiné číslo na konci dá jiný terén. Potřebuje numpy, scipy a scikit-image.
"""
import sys, numpy as np
from scipy.ndimage import gaussian_filter
from skimage.measure import find_contours, approximate_polygon

W, H = 1600, 1600
rng = np.random.default_rng(int(sys.argv[2]) if len(sys.argv) > 2 else 7)
gx, gy = 280, 280  # mřížka výpočtu
pole = np.zeros((gy, gx))
# pár „kopců" s různou velikostí, víc u okrajů (střed stránky zůstane klidnější pro text)
for _ in range(20):
    cx, cy = rng.uniform(-0.1, 1.1) * gx, rng.uniform(-0.1, 1.1) * gy
    s = rng.uniform(18, 55)
    a = rng.uniform(0.6, 1.4) * rng.choice([1, 1, -1])
    yy, xx = np.mgrid[0:gy, 0:gx]
    pole += a * np.exp(-(((xx - cx) ** 2) / (2 * s * s * rng.uniform(0.6, 1.6)) + ((yy - cy) ** 2) / (2 * s * s)))
pole += gaussian_filter(rng.normal(size=(gy, gx)), 9) * 2.2
pole = gaussian_filter(pole, 2.2)
urovne = np.linspace(pole.min(), pole.max(), 28)[1:-1]
d = []
for u in urovne:
    for c in find_contours(pole, u):
        if len(c) < 18:
            continue
        c = approximate_polygon(c, tolerance=0.35)
        body = [(x * W / (gx - 1), y * H / (gy - 1)) for y, x in c]
        # vyhlazení: kvadratické křivky přes středy úseček
        p = f"M{body[0][0]:.0f} {body[0][1]:.0f}"
        for i in range(1, len(body) - 1):
            mx, my = (body[i][0] + body[i + 1][0]) / 2, (body[i][1] + body[i + 1][1]) / 2
            p += f"Q{body[i][0]:.0f} {body[i][1]:.0f} {mx:.0f} {my:.0f}"
        p += f"L{body[-1][0]:.0f} {body[-1][1]:.0f}"
        d.append(p)
barva = sys.argv[1] if len(sys.argv) > 1 else "#D9CFBD"
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">'
       f'<path fill="none" stroke="{barva}" stroke-width="1.1" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" d="{"".join(d)}"/></svg>')
print(svg)
