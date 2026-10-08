// Fyzika pohybu pro glóbus a mapy, podle Applu (WWDC „Designing Fluid Interfaces"):
// pružina bez překmitu, která jde kdykoli přesměrovat, setrvačnost po puštění prstu,
// měření rychlosti prstu a měkký okraj (rubber-band) místo tvrdého zastavení.

export const klidne = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// --- Měření rychlosti prstu z posledních ~100 ms pohybu (jednotky za sekundu)
export function merickoRychlosti() {
  let body: { x: number; y: number; t: number }[] = [];
  return {
    zacni(x: number, y: number) { body = [{ x, y, t: performance.now() }]; },
    pridej(x: number, y: number) {
      const t = performance.now();
      body.push({ x, y, t });
      while (body.length > 2 && t - body[0].t > 100) body.shift();
    },
    // Rychlost v px/s v okamžiku puštění. Když prst před puštěním stál, je nulová.
    rychlost(): [number, number] {
      const t = performance.now();
      const posl = body.at(-1);
      if (!posl || body.length < 2 || t - posl.t > 80) return [0, 0];
      const prvni = body[0];
      const dt = Math.max(16, posl.t - prvni.t) / 1000;
      return [(posl.x - prvni.x) / dt, (posl.y - prvni.y) / dt];
    },
  };
}

// --- Setrvačnost: rychlost exponenciálně slábne jako při scrollu.
// zpomaleni ≈ 0.998 je běžný scroll, nižší číslo = kratší doběh.
// krok dostane posun za snímek a vrací osy, které narazily na okraj (ty se zastaví).
// min = rychlost, pod kterou se pohyb zastaví; start = pod touto rychlostí se vůbec nerozjede.
export function setrvacnost(
  v0: [number, number],
  krok: (dx: number, dy: number) => [boolean, boolean] | void,
  volby: { hotovo?: () => void; zpomaleni?: number; min?: number; start?: number } = {},
) {
  const { hotovo, zpomaleni = 0.996, min: MIN = 8, start = 40 } = volby;
  let [vx, vy] = v0;
  let id: number | null = null;
  let pred = performance.now();
  const zastav = () => { if (id !== null) cancelAnimationFrame(id); id = null; };
  if (klidne() || Math.hypot(vx, vy) < start) { hotovo?.(); return { zastav, bezi: () => false }; }
  const snimek = (t: number) => {
    const dt = Math.min(48, t - pred);
    pred = t;
    const utlum = Math.pow(zpomaleni, dt);
    // přesný posun za dt při exponenciálním útlumu
    const k = (utlum - 1) / Math.log(zpomaleni) / 1000;
    const naraz = krok(vx * k, vy * k);
    vx *= utlum; vy *= utlum;
    if (naraz) { if (naraz[0]) vx = 0; if (naraz[1]) vy = 0; }
    if (Math.hypot(vx, vy) < MIN) { id = null; hotovo?.(); return; }
    id = requestAnimationFrame(snimek);
  };
  id = requestAnimationFrame(snimek);
  return { zastav, bezi: () => id !== null };
}

// O kolik se setrvačností ještě posune (Applova projekce, px).
export const projekce = (v: number, zpomaleni = 0.996) => ((v / 1000) * zpomaleni) / (1 - zpomaleni);

// --- Měkký okraj: čím dál za hranou, tím méně prvek následuje prst
export function gumove(prekroceni: number, rozmer: number, c = 0.55) {
  const a = Math.abs(prekroceni);
  return Math.sign(prekroceni) * ((a * rozmer * c) / (rozmer + c * a));
}
// Inverze k gumove: z viditelného přesahu vrátí skutečný posun prstu.
export function zpetGumove(viditelne: number, rozmer: number, c = 0.55) {
  const a = Math.min(Math.abs(viditelne), rozmer * 0.999);
  return Math.sign(viditelne) * ((a * rozmer) / (c * (rozmer - a)));
}

// --- Pružina bez překmitu (kriticky tlumená, damping 1.0).
// odezva = Applův parametr „response" v sekundách (0.3–0.4 pro běžné UI).
// Jde přesměrovat kdykoli: nový cíl navazuje na aktuální polohu i rychlost.
export function pruzina(cist: () => number[], psat: (x: number[]) => void, odezva = 0.4) {
  let x: number[] = [];
  let v: number[] = [];
  let cil: number[] = [];
  let id: number | null = null;
  let pred = 0;
  let hotovo: (() => void) | undefined;
  const w = (2 * Math.PI) / odezva;

  const snimek = (t: number) => {
    const dt = Math.min(0.048, (t - pred) / 1000);
    pred = t;
    const e = Math.exp(-w * dt);
    let klid = true;
    for (let i = 0; i < x.length; i++) {
      // přesné řešení kriticky tlumeného oscilátoru za dt
      const c1 = x[i] - cil[i];
      const c2 = v[i] + w * c1;
      x[i] = cil[i] + (c1 + c2 * dt) * e;
      v[i] = (c2 - w * (c1 + c2 * dt)) * e;
      const meritko = Math.max(1e-3, Math.abs(cil[i]) * 1e-4);
      if (Math.abs(x[i] - cil[i]) > meritko || Math.abs(v[i]) > meritko * 10) klid = false;
    }
    if (klid) { x = cil.slice(); psat(x); id = null; const h = hotovo; hotovo = undefined; h?.(); return; }
    psat(x);
    id = requestAnimationFrame(snimek);
  };

  return {
    // Rozjede pružinu k cíli. Volitelně s počáteční rychlostí (např. z puštěného prstu).
    k(novyCil: number[], volby: { rychlost?: number[]; hotovo?: () => void } = {}) {
      const bezelo = id !== null;
      x = cist();
      if (!bezelo || v.length !== x.length) v = x.map(() => 0);
      if (volby.rychlost) v = volby.rychlost.slice();
      cil = novyCil.slice();
      hotovo = volby.hotovo;
      if (klidne()) { x = cil.slice(); psat(x); if (id !== null) cancelAnimationFrame(id); id = null; hotovo?.(); return; }
      if (id === null) { pred = performance.now(); id = requestAnimationFrame(snimek); }
    },
    zastav() { if (id !== null) cancelAnimationFrame(id); id = null; v = v.map(() => 0); },
    bezi: () => id !== null,
  };
}
