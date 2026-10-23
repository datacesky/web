// Vzhled webu (světlý / tmavý) pro skripty, které kreslí do canvasu nebo nastavují barvy přímo.
// Barvy se berou z CSS proměnných v src/styles/global.css, takže stačí měnit je tam.

export type Tema = 'svetly' | 'tmavy';

export const tema = (): Tema => (document.documentElement.dataset.tema === 'tmavy' ? 'tmavy' : 'svetly');
export const jeTmavy = () => tema() === 'tmavy';

// Hodnota CSS proměnné, např. barva('navy') → '#1B2A4A' (ve světlém režimu)
export const barva = (jmeno: string) => getComputedStyle(document.documentElement).getPropertyValue('--' + jmeno).trim();

// Zavolá fn pokaždé, když se vzhled přepne (tlačítkem nebo podle nastavení zařízení)
export const priZmeneTematu = (fn: (t: Tema) => void) => document.addEventListener('tema', () => fn(tema()));
