// Našeptávač pro vyhledávání (státy, kraje, města). Hledá bez ohledu na diakritiku
// a velká písmena, ovládá se šipkami, Enterem a Escape.

export type Polozka = { kod: string; nazev: string; vlajka?: string; popis?: string; hledat?: string };

export const bezDiakritiky = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Jiné názvy, pod kterými lidé země hledají
export const PREZDIVKY: Record<string, string> = {
  USA: 'amerika spojene staty usa us',
  GBR: 'anglie britanie uk spojene kralovstvi skotsko',
  NLD: 'holandsko',
  ARE: 'emiraty sae dubaj',
  KOR: 'korea',
  CZE: 'ceska republika cr',
  DEU: 'nemecko spolkova',
  CHE: 'svycarsko',
  COD: 'kongo kinshasa',
  CIV: 'cote divoire',
  MMR: 'barma',
  SWZ: 'svazijsko',
  TUR: 'turecko turkiye',
  PSE: 'palestinska uzemi',
};

type Volby = {
  max?: number;
  // Po výběru vymazat pole (vyhledávání) nebo nechat název (formulář)
  vymazat?: boolean;
};

export function naseptavac(vstup: HTMLInputElement, seznam: HTMLElement, polozky: Polozka[], onVyber: (p: Polozka) => void, volby: Volby = {}) {
  const max = volby.max ?? 7;
  const index = polozky.map((p) => ({ p, t: bezDiakritiky(`${p.nazev} ${p.hledat ?? ''} ${PREZDIVKY[p.kod] ?? ''}`), n: bezDiakritiky(p.nazev) }));
  let shody: Polozka[] = [];
  let aktivni = -1;
  if (!seznam.id) seznam.id = `naseptavac-${Math.random().toString(36).slice(2, 8)}`;
  vstup.setAttribute('role', 'combobox');
  vstup.setAttribute('aria-autocomplete', 'list');
  vstup.setAttribute('aria-controls', seznam.id);
  vstup.setAttribute('aria-expanded', 'false');
  seznam.setAttribute('role', 'listbox');

  const zavri = () => { seznam.hidden = true; vstup.setAttribute('aria-expanded', 'false'); aktivni = -1; };
  const vyber = (p: Polozka) => {
    vstup.value = volby.vymazat ? '' : p.nazev;
    zavri();
    onVyber(p);
  };
  const oznac = () => {
    seznam.querySelectorAll<HTMLElement>('[role="option"]').forEach((b, i) => b.setAttribute('aria-selected', String(i === aktivni)));
  };

  function nabidni() {
    const q = bezDiakritiky(vstup.value.trim());
    if (!q) { shody = []; seznam.replaceChildren(); return zavri(); }
    shody = index
      .filter((x) => x.t.includes(q))
      .sort((a, b) => Number(!a.n.startsWith(q)) - Number(!b.n.startsWith(q)) || a.n.localeCompare(b.n, 'cs'))
      .slice(0, max)
      .map((x) => x.p);
    aktivni = shody.length ? 0 : -1;
    if (!shody.length) {
      const li = document.createElement('li');
      li.className = 'naseptavac__nic';
      li.textContent = 'Nic takového nemám.';
      seznam.replaceChildren(li);
    } else {
      seznam.replaceChildren(...shody.map((p, i) => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.tabIndex = -1;
        b.setAttribute('role', 'option');
        b.setAttribute('aria-selected', String(i === aktivni));
        if (p.vlajka) {
          const img = document.createElement('img');
          img.src = p.vlajka; img.alt = ''; img.className = 'vlajka'; img.loading = 'lazy';
          b.append(img);
        }
        const t = document.createElement('span');
        t.className = 'naseptavac__text';
        t.append(p.nazev);
        if (p.popis) { const s = document.createElement('small'); s.textContent = p.popis; t.append(s); }
        b.append(t);
        b.addEventListener('mousedown', (e) => { e.preventDefault(); vyber(p); });
        li.append(b);
        return li;
      }));
    }
    seznam.hidden = false;
    vstup.setAttribute('aria-expanded', 'true');
  }

  vstup.addEventListener('input', nabidni);
  vstup.addEventListener('focus', () => { if (vstup.value.trim()) nabidni(); });
  vstup.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!shody.length) return;
      aktivni = (aktivni + (e.key === 'ArrowDown' ? 1 : -1) + shody.length) % shody.length;
      oznac();
    } else if (e.key === 'Enter') {
      const p = shody[aktivni] ?? shody[0];
      if (p) { e.preventDefault(); vyber(p); }
    } else if (e.key === 'Escape') {
      zavri();
    }
  });
  vstup.addEventListener('blur', () => setTimeout(zavri, 120));
  return { zavri, nabidni };
}
