// Přibližování a posouvání SVG mapy přes transformaci skupiny <g>.
// Kolečko myši přibližuje jen s Ctrl/⌘ (sevření prstů na touchpadu posílá Ctrl samo),
// jinak by mapa „kradla" posouvání stránky. Na dotyku funguje sevření dvěma prsty.

export type Zoom = {
  z: () => number;
  plus: () => void;
  minus: () => void;
  reset: (plynule?: boolean) => void;
  // Přiblíží na obdélník v souřadnicích SVG [x0, y0, x1, y1]
  naObdelnik: (b: [number, number, number, number], max?: number) => void;
  // true hned po tažení – kliknutí, které tažení ukončilo, se má ignorovat
  poTazeni: () => boolean;
};

type Volby = {
  sirka: number;
  vyska: number;
  max?: number;
  napoveda?: HTMLElement | null;
  onZmena?: (z: number) => void;
};

export function zoomSkupiny(svg: SVGSVGElement, g: SVGGElement, o: Volby): Zoom {
  const MAX = o.max ?? 6;
  const klidne = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let z = 1, tx = 0, ty = 0;
  let animace: number | null = null;
  let posledniTah = 0;

  const omez = () => {
    tx = Math.min(0, Math.max(o.sirka * (1 - z), tx));
    ty = Math.min(0, Math.max(o.vyska * (1 - z), ty));
  };
  const pouzij = () => {
    omez();
    g.setAttribute('transform', `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${z.toFixed(4)})`);
    svg.style.setProperty('--z', z.toFixed(4));
    svg.classList.toggle('je-priblizeno', z > 1.01);
    o.onZmena?.(z);
  };
  const doSvg = (cx: number, cy: number) => {
    const m = svg.getScreenCTM();
    if (!m) return { x: o.sirka / 2, y: o.vyska / 2 };
    const p = new DOMPoint(cx, cy).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  const jednotekNaPixel = () => o.sirka / Math.max(1, svg.getBoundingClientRect().width);

  function nastav(nz: number, ntx: number, nty: number, plynule = false) {
    nz = Math.min(MAX, Math.max(1, nz));
    if (!plynule || klidne) { z = nz; tx = ntx; ty = nty; return pouzij(); }
    const [z0, x0, y0] = [z, tx, ty];
    const start = performance.now();
    if (animace) cancelAnimationFrame(animace);
    const krok = (t: number) => {
      const k = Math.min(1, (t - start) / 450);
      const e = 1 - Math.pow(1 - k, 3);
      z = z0 + (nz - z0) * e; tx = x0 + (ntx - x0) * e; ty = y0 + (nty - y0) * e;
      pouzij();
      if (k < 1) animace = requestAnimationFrame(krok);
    };
    animace = requestAnimationFrame(krok);
  }
  // Přiblíží tak, aby bod (px, py) v souřadnicích SVG zůstal na místě.
  function kolemBodu(nz: number, px: number, py: number, plynule = false) {
    nz = Math.min(MAX, Math.max(1, nz));
    nastav(nz, px - (px - tx) * (nz / z), py - (py - ty) * (nz / z), plynule);
  }

  let napovedaCas: number | undefined;
  svg.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) {
      if (o.napoveda) {
        o.napoveda.hidden = false;
        clearTimeout(napovedaCas);
        napovedaCas = window.setTimeout(() => (o.napoveda!.hidden = true), 1400);
      }
      return;
    }
    e.preventDefault();
    const p = doSvg(e.clientX, e.clientY);
    kolemBodu(z * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0025)), p.x, p.y);
  }, { passive: false });

  svg.addEventListener('dblclick', (e) => {
    e.preventDefault();
    const p = doSvg(e.clientX, e.clientY);
    kolemBodu(z * 2, p.x, p.y, true);
  });

  // Tažení (posun) a sevření prsty
  const prsty = new Map<number, { x: number; y: number }>();
  let tah: { x: number; y: number; tx: number; ty: number; posun: number } | null = null;
  let stisk: { d: number; z: number; mx: number; my: number } | null = null;
  svg.addEventListener('pointerdown', (e) => {
    prsty.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (prsty.size === 2) {
      const [a, b] = [...prsty.values()];
      const m = doSvg((a.x + b.x) / 2, (a.y + b.y) / 2);
      stisk = { d: Math.hypot(a.x - b.x, a.y - b.y), z, mx: m.x, my: m.y };
      tah = null;
      try { svg.setPointerCapture(e.pointerId); } catch {}
    } else if (z > 1.01 && e.button === 0) {
      tah = { x: e.clientX, y: e.clientY, tx, ty, posun: 0 };
    }
  });
  svg.addEventListener('pointermove', (e) => {
    if (!prsty.has(e.pointerId)) return;
    prsty.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (stisk && prsty.size === 2) {
      const [a, b] = [...prsty.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      kolemBodu(stisk.z * (d / Math.max(1, stisk.d)), stisk.mx, stisk.my);
      posledniTah = performance.now();
      return;
    }
    if (tah) {
      const dx = e.clientX - tah.x, dy = e.clientY - tah.y;
      tah.posun = Math.max(tah.posun, Math.hypot(dx, dy));
      if (tah.posun > 4) {
        try { svg.setPointerCapture(e.pointerId); } catch {}
        svg.classList.add('se-taha');
        const k = jednotekNaPixel();
        tx = tah.tx + dx * k; ty = tah.ty + dy * k;
        pouzij();
      }
    }
  });
  const konec = (e: PointerEvent) => {
    prsty.delete(e.pointerId);
    if (prsty.size < 2) stisk = null;
    if (tah && tah.posun > 4) posledniTah = performance.now();
    tah = null;
    svg.classList.remove('se-taha');
  };
  svg.addEventListener('pointerup', konec);
  svg.addEventListener('pointercancel', konec);

  pouzij();
  return {
    z: () => z,
    plus: () => kolemBodu(z * 1.6, o.sirka / 2, o.vyska / 2, true),
    minus: () => kolemBodu(z / 1.6, o.sirka / 2, o.vyska / 2, true),
    reset: (plynule = true) => nastav(1, 0, 0, plynule),
    naObdelnik: ([x0, y0, x1, y1], max = 4) => {
      const nz = Math.min(max, MAX, Math.max(1, Math.min(o.sirka / Math.max(1, (x1 - x0) * 1.5), o.vyska / Math.max(1, (y1 - y0) * 1.5))));
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      nastav(nz, o.sirka / 2 - cx * nz, o.vyska / 2 - cy * nz, true);
    },
    poTazeni: () => performance.now() - posledniTah < 250,
  };
}
