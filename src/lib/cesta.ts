// Řízení příběhu na úvodní stránce (src/components/uvod/Cesta.astro): podle scrollu říká glóbusu,
// kam se má dívat a jak obarvit státy, ukazuje mapu Česka se supermarkety, legendu, aktivní kapitolu
// a bublinu s názvem státu pod myší. Načítá se až po prvním vykreslení stránky.
import { spustGlobus, type Pohled, type Obarveni } from './globus';
import { zebricek, vrstvaPodleId, jmeno } from './svet';
import { hranice, trida } from './mapa';

type EuSada = { id: string; hodnoty: Record<string, number>; desetinna: number; jednotka: string; stitek: string };
type Data = { epizody: string[]; eu: EuSada[]; supermarkety: string; projekce: { k: number; tx: number; ty: number } };

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const hladce = (x: number) => x * x * (3 - 2 * x);

export function spustCestu(koren: HTMLElement) {
  const data = JSON.parse(koren.dataset.json!) as Data;
  const $ = <T extends Element>(s: string) => koren.querySelector<T>(s)!;
  const platno = $<HTMLCanvasElement>('[data-platno]');
  const scena = $<HTMLElement>('[data-scena]');
  const mapa = $<HTMLElement>('[data-cz-mapa]');
  const svgMapa = $<SVGSVGElement>('[data-cz-svg]');
  const tip = $<HTMLElement>('[data-tip]');
  const legenda = $<HTMLElement>('[data-legenda]');
  const odkazyKapitol = koren.querySelectorAll<HTMLAnchorElement>('[data-kapitola]');
  const kroky = [...koren.querySelectorAll<HTMLElement>('[data-krok]')];
  const klidne = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nf = (v: number, d = 1) => new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v).replace(/ /g, ' ');

  let mapaVidet = 0;
  const g = spustGlobus(platno, { oblouky: data.epizody, zacatek: 0, priSnimku: polozMapu });

  // Mapa Česka se supermarkety sedí přesně na Česku, jak je zrovna nakreslené na glóbusu. Mapa krajů je
  // v Mercatorově projekci (src/data/cesko-mapa.json), glóbus v ortografické; obě zachovávají tvar,
  // takže stačí stejné měřítko a posun spočítané ve středu Česka.
  const P = data.projekce;
  const STRED: [number, number] = [15.47, 49.8];
  const svgX = (lon: number) => P.tx + P.k * (lon * Math.PI) / 180;
  const svgY = (lat: number) => P.ty - P.k * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  function polozMapu() {
    mapa.style.opacity = mapaVidet.toFixed(3);
    mapa.classList.toggle('je-videt', mapaVidet > 0.6);
    if (mapaVidet <= 0.001) return;
    const a = g.bod(STRED[0] - 0.5, STRED[1]), b = g.bod(STRED[0] + 0.5, STRED[1]), c = g.bod(STRED[0], STRED[1]);
    if (!a || !b || !c) return;
    const s = (b[0] - a[0]) / (svgX(STRED[0] + 0.5) - svgX(STRED[0] - 0.5));
    svgMapa.style.transform = `translate(${(c[0] - svgX(STRED[0]) * s).toFixed(1)}px, ${(c[1] - svgY(STRED[1]) * s).toFixed(1)}px) scale(${s.toFixed(4)})`;
  }

  // --- obarvení států
  const ep = new Set(data.epizody);
  const tridaPalety = (pal: string[], i: number, n: number) => pal[n <= 1 ? pal.length - 1 : Math.round((i * (pal.length - 1)) / (n - 1))];
  const serie: Obarveni = (a3) => (a3 === 'CZE' ? 'orange' : ep.has(a3) ? 'navy' : 'zeme');
  const cesko: Obarveni = (a3) => (a3 === 'CZE' ? 'orange' : 'zeme');
  // Pod mapou krajů se Česko na glóbusu ztratí: hrubý obrys ze světové mapy by vykukoval zpod přesné mapy
  const ceskoPodMapou: Obarveni = () => 'zeme';
  let podMapou = false;
  const obarveni = new Map<string, Obarveni>();
  function podleZebricku(id: string): Obarveni {
    const klic = 'z:' + id;
    if (!obarveni.has(klic)) {
      const z = zebricek(id);
      const hr = hranice(z.map((x) => x.v));
      const m = new Map(z.map((x) => [x.a3, tridaPalety(['s1', 's2', 's3', 's4', 's5'], trida(x.v, hr), hr.length + 1)]));
      obarveni.set(klic, (a3) => (a3 === 'CZE' ? 'orange' : m.get(a3) ?? 'bez-dat-2'));
    }
    return obarveni.get(klic)!;
  }
  function podleEu(id: string): Obarveni {
    const klic = 'e:' + id;
    if (!obarveni.has(klic)) {
      const sada = data.eu.find((x) => x.id === id);
      const hod = sada?.hodnoty ?? {};
      const hr = hranice(Object.values(hod));
      const m = new Map(Object.entries(hod).map(([a3, v]) => [a3, tridaPalety(['k1', 'k2', 'k3', 'k4', 'k5'], trida(v, hr), hr.length + 1)]));
      obarveni.set(klic, (a3) => (a3 === 'CZE' ? 'orange' : m.get(a3) ?? 'zeme'));
    }
    return obarveni.get(klic)!;
  }

  // --- kapitoly: pohled, barvy, legenda
  let zebricekId = $<HTMLElement>('[data-zebricek][aria-pressed="true"]')?.dataset.zebricek ?? 'stesti';
  let euId = $<HTMLElement>('[data-eu-sada][aria-pressed="true"]')?.dataset.euSada ?? data.eu[0]?.id;
  let aktivni = '';
  const POHLEDY: Record<string, Pohled> = {
    uvod: { lon: 17, lat: 36, k: 1 },
    svet: { lon: -40, lat: 12, k: 1 },
    zebricky: { lon: -300, lat: 24, k: 1 },
    evropa: { lon: -345, lat: 51, k: 2.6 },
    cesko: { lon: -344.6, lat: 49.8, k: 14 },
  };
  const telefon = () => innerWidth < 900;
  function prepocitejCesko() {
    const z = g.zoomNaCesko(telefon() ? 0.86 : 0.76);
    POHLEDY.cesko = { lon: z.lon - 360, lat: z.lat, k: z.k };
  }

  const tecka = (barva: string, text: string) => `<span><i style="background: var(--${barva});"></i>${text}</span>`;
  const skala = (pal: string, text: string) => `<span><i class="skala" style="background: linear-gradient(90deg, var(--${pal}1), var(--${pal}3), var(--${pal}5));"></i>${text}</span>`;
  function obarviKapitolu() {
    if (aktivni === 'zebricky') {
      g.obarvi(podleZebricku(zebricekId)); g.oblouky(false);
      legenda.innerHTML = tecka('orange', 'Česko') + skala('s', `${vrstvaPodleId(zebricekId)?.nazev ?? ''}: méně → víc`);
    } else if (aktivni === 'evropa') {
      g.obarvi(podleEu(euId)); g.oblouky(false);
      const s = data.eu.find((x) => x.id === euId);
      legenda.innerHTML = tecka('orange', 'Česko') + skala('k', `${s?.stitek ?? ''} v zemích EU: méně → víc`);
    } else if (aktivni === 'cesko') {
      g.obarvi(podMapou ? ceskoPodMapou : cesko); g.oblouky(false);
      legenda.innerHTML = '<span>Každá tečka je jeden supermarket. Klikni na řetězec a zůstane jen on.</span>';
    } else {
      g.obarvi(serie); g.oblouky(true);
      legenda.innerHTML = tecka('orange', 'Česko') + tecka('navy', `${data.epizody.length} zemí ze série Česko vs. svět`);
    }
  }
  function nastavKapitolu(k: string) {
    aktivni = k;
    g.samoOtaceni(k === 'uvod');
    obarviKapitolu();
    for (const a of odkazyKapitol) a.classList.toggle('je-aktivni', a.dataset.kapitola === k);
    for (const el of kroky) el.classList.toggle('je-aktivni', el.dataset.krok === k);
    scena.dataset.kapitola = k;
  }

  // --- scroll: kotvy kapitol (kdy je kapitola uprostřed čtecí plochy) a plynulý přechod mezi nimi
  let kotvy: number[] = [];
  function zmer() {
    prepocitejCesko();
    const vh = innerHeight;
    // na telefonu je nahoře glóbus, čte se v ploše pod ním
    const s = scena.getBoundingClientRect();
    const hv = parseFloat(getComputedStyle(scena).top) || 64;
    const stred = telefon() ? hv + s.height + (vh - hv - s.height) / 2 : vh / 2 + hv / 2;
    kotvy = kroky.map((el, i) => {
      if (i === 0) return 0;
      const r = el.getBoundingClientRect();
      return Math.max(1, r.top + scrollY + r.height / 2 - stred);
    });
    for (let i = 1; i < kotvy.length; i++) kotvy[i] = Math.max(kotvy[i], kotvy[i - 1] + 1);
    naScroll(true);
  }
  function naScroll(okamzite = false) {
    const y = scrollY;
    let i = 0;
    while (i < kotvy.length - 1 && y >= kotvy[i + 1]) i++;
    const a = kotvy[i], b = kotvy[i + 1] ?? a;
    const f = b > a ? clamp((y - a) / (b - a)) : 0;
    const k0 = kroky[i].dataset.krok!, k1 = kroky[i + 1]?.dataset.krok ?? k0;
    const A = POHLEDY[k0], B = POHLEDY[k1];
    // glóbus v klidu, dokud čteš kapitolu, a pohne se mezi nimi
    const e = hladce(clamp((f - 0.16) / 0.68));
    const p: Pohled = klidne
      ? POHLEDY[f < 0.5 ? k0 : k1]
      : { lon: A.lon + (B.lon - A.lon) * e, lat: A.lat + (B.lat - A.lat) * e, k: Math.exp(Math.log(A.k) + (Math.log(B.k) - Math.log(A.k)) * e) };
    g.nastav(p, okamzite && aktivni === '');
    const nova = f < 0.5 ? k0 : k1;
    if (nova !== aktivni) nastavKapitolu(nova);
    mapaVidet = k1 === 'cesko' && k0 !== 'cesko' ? (klidne ? (f < 0.5 ? 0 : 1) : hladce(clamp((f - 0.66) / 0.28))) : k0 === 'cesko' ? 1 : 0;
    if (mapaVidet > 0.5) skryjTip();
    const pod = mapaVidet > 0.3;
    if (pod !== podMapou) { podMapou = pod; if (aktivni === 'cesko') g.obarvi(pod ? ceskoPodMapou : cesko); }
    g.prekresli();
  }
  addEventListener('scroll', () => naScroll(), { passive: true });
  addEventListener('resize', () => zmer());
  addEventListener('load', zmer);
  new ResizeObserver(() => zmer()).observe(koren);

  // odkazy na kapitoly (lišta pod glóbusem, „Projeď to celé“): dojede tak, aby kapitola byla uprostřed
  koren.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#k-"]');
    if (!a) return;
    const i = kroky.findIndex((k) => `#${k.id}` === a.getAttribute('href'));
    if (i < 0) return;
    e.preventDefault();
    scrollTo({ top: kotvy[i] + 1, behavior: klidne ? 'auto' : 'smooth' });
  });

  // přepínače v kapitolách (posílá je Cesta.astro)
  koren.addEventListener('cesta:zebricek', (e) => { zebricekId = (e as CustomEvent).detail; if (aktivni === 'zebricky') obarviKapitolu(); });
  koren.addEventListener('cesta:eu', (e) => { euId = (e as CustomEvent).detail; if (aktivni === 'evropa') obarviKapitolu(); });

  // vlajky: najetí (na dotyku první ťuknutí) natočí glóbus na zemi, druhé ťuknutí ji otevře
  const dotyk = matchMedia('(hover: none)').matches;
  let zamereno: HTMLAnchorElement | null = null;
  const zamer = (a: HTMLAnchorElement | null) => {
    zamereno?.classList.remove('je-zamer');
    zamereno = a;
    a?.classList.add('je-zamer');
    g.zamer(a?.dataset.zeme ?? null);
  };
  for (const a of koren.querySelectorAll<HTMLAnchorElement>('[data-vlajky] a')) {
    a.addEventListener('mouseenter', () => zamer(a));
    a.addEventListener('mouseleave', () => zamer(null));
    a.addEventListener('focus', () => zamer(a));
    a.addEventListener('blur', () => { if (!dotyk) zamer(null); });
    a.addEventListener('click', (e) => { if (dotyk && zamereno !== a) { e.preventDefault(); zamer(a); } });
  }
  addEventListener('scroll', () => { if (zamereno && aktivni !== 'svet' && aktivni !== 'uvod') zamer(null); }, { passive: true });

  // --- bublina se jménem státu pod myší a klik na glóbus
  const popis = (a3: string): string => {
    const n = jmeno(a3);
    if (a3 === 'CZE') return '<b>Česko</b>';
    if (aktivni === 'zebricky') {
      const z = zebricek(zebricekId).find((x) => x.a3 === a3);
      return z ? `${n} · <b>${z.r}. ${vrstvaPodleId(zebricekId)?.poradiSlovo ?? ''}</b>` : `${n} · bez dat`;
    }
    if (aktivni === 'evropa') {
      const s = data.eu.find((x) => x.id === euId);
      const v = s?.hodnoty[a3];
      return v === undefined ? n : `${n} · <b>${nf(v, s!.desetinna)}${s!.jednotka === '%' ? ' %' : ' ' + s!.jednotka}</b>`;
    }
    const i = data.epizody.indexOf(a3);
    return i >= 0 ? `${n} · <b>díl ${i + 1}</b>` : n;
  };
  function skryjTip() { tip.hidden = true; }
  let cekaTip = false, posledni: PointerEvent | null = null;
  platno.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || e.buttons) { skryjTip(); return; }
    posledni = e;
    if (cekaTip) return;
    cekaTip = true;
    requestAnimationFrame(() => {
      cekaTip = false;
      if (!posledni || mapaVidet > 0.5) return skryjTip();
      const r = platno.getBoundingClientRect();
      const x = posledni.clientX - r.left, y = posledni.clientY - r.top;
      const a3 = g.statNa(x, y);
      if (!a3) return skryjTip();
      tip.innerHTML = popis(a3);
      tip.style.left = `${x}px`; tip.style.top = `${y}px`;
      tip.hidden = false;
      platno.style.cursor = 'pointer';
    });
  });
  platno.addEventListener('pointerleave', () => { skryjTip(); platno.style.cursor = ''; });
  platno.addEventListener('click', (e) => {
    if (!g.kliknuti()) return;
    const r = platno.getBoundingClientRect();
    const a3 = mapaVidet > 0.5 ? null : g.statNa(e.clientX - r.left, e.clientY - r.top);
    const url = aktivni === 'zebricky' ? `/zebricky/#z=${zebricekId}`
      : aktivni === 'evropa' ? `/novinky/#n-${euId}`
      : aktivni === 'cesko' ? data.supermarkety
      : a3 && a3 !== 'CZE' ? `/svet/#z=${a3}` : '/svet/';
    location.href = url;
  });

  zmer();
  requestAnimationFrame(() => requestAnimationFrame(() => koren.classList.add('je-zivy')));
}
