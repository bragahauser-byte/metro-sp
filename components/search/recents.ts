// Buscas recentes, como no Apple Maps. Ficam só neste navegador; a localização do GPS nunca entra.
import { type Spot, decodeSpot, encodeSpot } from "./place-search";

const KEY = "metro:recentes";
const MAX = 6;

type Stored = { v: string; detalhe?: string };

export function readRecents(): Spot[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Stored[];
    return raw
      .map((r) => {
        const s = decodeSpot(r.v);
        return s?.kind === "place" ? { ...s, detalhe: r.detalhe ?? "" } : s;
      })
      .filter((s): s is Spot => s !== null);
  } catch {
    return [];
  }
}

export function addRecent(s: Spot) {
  const v = encodeSpot(s);
  if (!v) return;
  try {
    const raw = (JSON.parse(localStorage.getItem(KEY) ?? "[]") as Stored[]).filter((r) => r.v !== v);
    raw.unshift({ v, detalhe: s.kind === "place" ? s.detalhe : undefined });
    localStorage.setItem(KEY, JSON.stringify(raw.slice(0, MAX)));
  } catch {
    // Sem armazenamento (aba privada, bloqueio): a busca funciona do mesmo jeito.
  }
}

export function clearRecents() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // idem
  }
}
