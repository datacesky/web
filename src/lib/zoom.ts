// Přibližování a posouvání SVG mapy přes transformaci skupiny <g>.
// Kolečko myši přibližuje jen s Ctrl/⌘ (sevření prstů na touchpadu posílá Ctrl samo),
// jinak by mapa „kradla" posouvání stránky. Na dotyku funguje sevření dvěma prsty.
// Pohyb: přiblížení pružinou bez překmitu, po puštění mapa doběhne setrvačností
// a za okrajem klade odpor, pak se vrátí (src/lib/pohyb.ts).
import { pruzina, setrvacnost, merickoRychlosti, gumove, zpetGumove } from './pohyb';

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
  let z = 1, tx = 0, ty = 0;
  let posledniTah = 0;

  const meze = () => ({ x0: o.sirka * (1 - z), y0: o.vyska * (1 - z) });
  const omez = () => {
    const m = meze();
    tx = Math.min(0, Math.max(m.x0, tx));
    ty = Math.min(0, Math.max(m.y0, ty));
  };
  // Při tažení za okraj mapa jen měkce povolí (rubber-band), nezastaví se natvrdo.
  const pruzne = (v: number, min: number, rozmer: number) => (v > 0 ? gumove(v, rozmer) : v < min ? min + gumove(v - min, rozmer) : v);
  // Opak: ze zobrazené polohy za okrajem spočítá, kde „doopravdy" je prst (chycení za letu bez skoku).
  const surove = (v: number, min: number, rozmer: number) => (v > 0 ? zpetGumove(v, rozmer) : v < min ? min + zpetGumove(v - min, rozmer) : v);
  const vykresli = () => {
    g.setAttribute('transform', `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${z.toFixed(4)})`);
    svg.style.setProperty('--z', z.toFixed(4));
    svg.classList.toggle('je-priblizeno', z > 1.01);
    o.onZmena?.(z);
  };
  const pouzij = () => { omez(); vykresli(); };
  const doSvg = (cx: number, cy: number) => {
    const m = svg.getScreenCTM();
    if (!m) return { x: o.sirka / 2, y: o.vyska / 2 };
    const p = new DOMPoint(cx, cy).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  const jednotekNaPixel = () => o.sirka / Math.max(1, svg.getBoundingClientRect().width);

  // Jedna pružina pro [z, tx, ty]; lineární průběh drží bod přiblížení na místě.
  // Při návratu zpoza okraje se poloha neomezuje, jinak by mapa na hranu skočila.
  let navrat = false;
  const kamera = pruzina(() => [z, tx, ty], ([nz, nx, ny]) => { z = nz; tx = nx; ty = ny; navrat ? vykresli() : pouzij(); }, 0.4);
  let dobeh: { zastav: () => void } | null = null;
  const zastavPohyb = () => { kamera.zastav(); navrat = false; dobeh?.zastav(); dobeh = null; };

  function nastav(nz: number, ntx: number, nty: number, plynule = false) {
    nz = Math.min(MAX, Math.max(1, nz));
    // cíl rovnou omezíme, ať pružina nemíří mimo mapu
    const mx = o.sirka * (1 - nz), my = o.vyska * (1 - nz);
    ntx = Math.min(0, Math.max(mx, ntx));
    nty = Math.min(0, Math.max(my, nty));
    dobeh?.zastav(); dobeh = null;
    if (!plynule) { kamera.zastav(); z = nz; tx = ntx; ty = nty; return pouzij(); }
    kamera.k([nz, ntx, nty]);
  }
  // Přiblíží tak, aby bod (px, py) v souřadnicích SVG zůstal na místě.
  // Když už pružina běží, počítá se od jejího cíle, ať rychlé klikání přiblíží víc.
  let cilZ = 1;
  function kolemBodu(nz: number, px: number, py: number, plynule = false) {
    nz = Math.min(MAX, Math.max(1, nz));
    nastav(nz, px - (px - tx) * (nz / z), py - (py - ty) * (nz / z), plynule);
    cilZ = nz;
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
    zastavPohyb();
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
  const mereni = merickoRychlosti();
  let tah: { x: number; y: number; tx: number; ty: number; posun: number } | null = null;
  let stisk: { d: number; z: number; mx: number; my: number } | null = null;
  svg.addEventListener('pointerdown', (e) => {
    // Chycení mapy okamžitě zastaví běžící animaci i doběh (bez skoku, jede se od aktuální polohy).
    zastavPohyb();
    prsty.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (prsty.size === 2) {
      const [a, b] = [...prsty.values()];
      const m = doSvg((a.x + b.x) / 2, (a.y + b.y) / 2);
      stisk = { d: Math.hypot(a.x - b.x, a.y - b.y), z, mx: m.x, my: m.y };
      tah = null;
      try { svg.setPointerCapture(e.pointerId); } catch {}
    } else if (z > 1.01 && e.button === 0) {
      const m = meze();
      tah = { x: e.clientX, y: e.clientY, tx: surove(tx, m.x0, o.sirka), ty: surove(ty, m.y0, o.vyska), posun: 0 };
      mereni.zacni(e.clientX, e.clientY);
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
      mereni.pridej(e.clientX, e.clientY);
      const dx = e.clientX - tah.x, dy = e.clientY - tah.y;
      tah.posun = Math.max(tah.posun, Math.hypot(dx, dy));
      if (tah.posun > 4) {
        try { svg.setPointerCapture(e.pointerId); } catch {}
        svg.classList.add('se-taha');
        const k = jednotekNaPixel();
        const m = meze();
        tx = pruzne(tah.tx + dx * k, m.x0, o.sirka);
        ty = pruzne(tah.ty + dy * k, m.y0, o.vyska);
        vykresli();
      }
    }
  });
  const konec = (e: PointerEvent) => {
    prsty.delete(e.pointerId);
    if (prsty.size < 2) stisk = null;
    const bylTah = tah && tah.posun > 4;
    if (bylTah) posledniTah = performance.now();
    tah = null;
    svg.classList.remove('se-taha');
    if (!bylTah) return;
    const m = meze();
    const mimo = tx > 0 || tx < m.x0 || ty > 0 || ty < m.y0;
    const k = jednotekNaPixel();
    const [vx, vy] = mereni.rychlost().map((v) => (e.type === 'pointercancel' ? 0 : v * k));
    if (mimo) {
      // Za okrajem: pružina vrátí mapu na hranu. Rychlost prstu převezme jen směrem dovnitř,
      // aby švihnutí ven mapu neodneslo ještě dál.
      const cx = Math.min(0, Math.max(m.x0, tx)), cy = Math.min(0, Math.max(m.y0, ty));
      const dovnitr = (v: number, odkud: number, kam: number) => (Math.sign(v) === Math.sign(kam - odkud) ? v : 0);
      navrat = true;
      kamera.k([z, cx, cy], { rychlost: [0, dovnitr(vx, tx, cx), dovnitr(vy, ty, cy)], hotovo: () => (navrat = false) });
      return;
    }
    // Uvnitř: mapa doběhne setrvačností, na okraji se zastaví.
    dobeh = setrvacnost([vx, vy], (dx, dy) => {
      const nx = tx + dx, ny = ty + dy;
      tx = nx; ty = ny;
      omez();
      vykresli();
      return [tx !== nx, ty !== ny];
    }, { hotovo: () => (dobeh = null) });
  };
  svg.addEventListener('pointerup', konec);
  svg.addEventListener('pointercancel', konec);

  pouzij();
  return {
    z: () => z,
    plus: () => kolemBodu((kamera.bezi() ? cilZ : z) * 1.6, o.sirka / 2, o.vyska / 2, true),
    minus: () => kolemBodu((kamera.bezi() ? cilZ : z) / 1.6, o.sirka / 2, o.vyska / 2, true),
    reset: (plynule = true) => { cilZ = 1; nastav(1, 0, 0, plynule); },
    naObdelnik: ([x0, y0, x1, y1], max = 4) => {
      const nz = Math.min(max, MAX, Math.max(1, Math.min(o.sirka / Math.max(1, (x1 - x0) * 1.5), o.vyska / Math.max(1, (y1 - y0) * 1.5))));
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      cilZ = nz;
      nastav(nz, o.sirka / 2 - cx * nz, o.vyska / 2 - cy * nz, true);
    },
    poTazeni: () => performance.now() - posledniTah < 250,
  };
}
