// Preferências de exibição e acessibilidade. Ficam só neste navegador (localStorage "prefs"),
// são sempre voluntárias e nunca mudam sozinhas (o tema, por exemplo, não segue o horário do dia).

export type Prefs = {
  tema: "sistema" | "claro" | "escuro";
  movimento: "sistema" | "reduzido";
  contraste: "padrao" | "mais";
  texto: "padrao" | "maior";
  /** Mostrar o botão de ouvir a rota. */
  voz: boolean;
  detalheVoz: "resumido" | "completo";
  /** Sinal sonoro curto quando a rota tem aviso. */
  sons: boolean;
};

export const DEFAULT_PREFS: Prefs = {
  tema: "sistema",
  movimento: "sistema",
  contraste: "padrao",
  texto: "padrao",
  voz: true,
  detalheVoz: "resumido",
  sons: false,
};

const KEY = "prefs";

export function readPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    // Versões anteriores guardavam só o tema.
    const old = localStorage.getItem("theme");
    if (old === "light") return { ...DEFAULT_PREFS, tema: "claro" };
    if (old === "dark") return { ...DEFAULT_PREFS, tema: "escuro" };
  } catch {}
  return DEFAULT_PREFS;
}

/** Aplica as preferências como atributos no <html>; o CSS (styles/tokens.css) faz o resto. */
export function applyPrefs(p: Prefs) {
  const el = document.documentElement;
  const set = (name: string, value: string | null) => (value ? el.setAttribute(name, value) : el.removeAttribute(name));
  set("data-theme", p.tema === "claro" ? "light" : p.tema === "escuro" ? "dark" : null);
  set("data-motion", p.movimento === "reduzido" ? "reduce" : null);
  set("data-contrast", p.contraste === "mais" ? "more" : null);
  set("data-text", p.texto === "maior" ? "large" : null);
}

const listeners = new Set<() => void>();
let cache: Prefs | null = null;

export function getPrefs(): Prefs {
  return (cache ??= readPrefs());
}

export function setPrefs(patch: Partial<Prefs>) {
  cache = { ...getPrefs(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
    localStorage.removeItem("theme");
  } catch {}
  applyPrefs(cache);
  listeners.forEach((l) => l());
}

export function subscribePrefs(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** "Reduzir movimento": a escolha do site vale mais que a do sistema. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  if (document.documentElement.getAttribute("data-motion") === "reduce") return true;
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Script inline do <head>: aplica as preferências antes da primeira pintura (sem piscar). */
export const PREFS_SCRIPT = `(function(){try{var d=document.documentElement,p=JSON.parse(localStorage.getItem("prefs")||"null"),o=localStorage.getItem("theme");if(!p&&o)p={tema:o==="dark"?"escuro":"claro"};if(!p)return;if(p.tema==="claro")d.setAttribute("data-theme","light");if(p.tema==="escuro")d.setAttribute("data-theme","dark");if(p.movimento==="reduzido")d.setAttribute("data-motion","reduce");if(p.contraste==="mais")d.setAttribute("data-contrast","more");if(p.texto==="maior")d.setAttribute("data-text","large")}catch(e){}})()`;
