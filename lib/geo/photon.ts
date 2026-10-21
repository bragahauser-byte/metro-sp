// Geocodificação com o Photon (https://photon.komoot.io), baseado no OpenStreetMap. Política: uso
// liberado para projetos, com moderação ("please be fair"); uso pesado é limitado. Por isso:
// mínimo de 3 letras, espera de 300 ms entre teclas, cancelamento de buscas antigas e cache.
import { RMSP_BBOX, inArea } from "./area.ts";
import type { LngLat } from "./walk.ts";

export const PHOTON_BASE = "https://photon.komoot.io";

export type PlaceKind = "endereco" | "rua" | "cep" | "bairro" | "cidade" | "lugar";

export type Place = {
  id: string;
  nome: string;
  /** Linha secundária: rua e número, bairro, cidade. */
  detalhe: string;
  tipo: PlaceKind;
  lngLat: LngLat;
};

export function photonUrl(q: string, near?: LngLat | null, limit = 8, base = PHOTON_BASE) {
  const u = new URLSearchParams({ q: q.trim(), limit: String(limit), lang: "default", bbox: RMSP_BBOX.join(",") });
  if (near && inArea(near)) {
    // Viés pela vista do mapa, arredondado (~100 m): o suficiente para priorizar, sem precisão.
    u.set("lat", near[1].toFixed(3));
    u.set("lon", near[0].toFixed(3));
  }
  return `${base}/api/?${u}`;
}

type PhotonProps = {
  osm_type?: string;
  osm_id?: number;
  osm_key?: string;
  osm_value?: string;
  type?: string;
  name?: string;
  street?: string;
  housenumber?: string;
  postcode?: string;
  district?: string;
  locality?: string;
  city?: string;
};
type PhotonFeature = { properties?: PhotonProps; geometry?: { coordinates?: number[] } };

function kindOf(p: PhotonProps): PlaceKind {
  if (p.osm_value === "postcode") return "cep";
  if (p.type === "house") return p.name ? "lugar" : "endereco";
  if (p.type === "street") return "rua";
  if (p.type === "district" || p.type === "locality") return "bairro";
  if (p.type === "city" || p.type === "county") return "cidade";
  return "lugar";
}

/** Converte a resposta do Photon em lugares, só dentro da Grande São Paulo e sem repetidos. */
export function parsePhoton(json: unknown): Place[] {
  const features = (json as { features?: PhotonFeature[] } | null)?.features;
  if (!Array.isArray(features)) return [];
  const seen = new Set<string>();
  const out: Place[] = [];
  for (const f of features) {
    const p = f.properties ?? {};
    const c = f.geometry?.coordinates;
    if (!c || c.length < 2 || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
    const lngLat: LngLat = [c[0], c[1]];
    if (!inArea(lngLat)) continue;
    // Estações de trem e metrô vêm da nossa própria lista (com linhas e horários), não do Photon.
    if (p.osm_key === "railway") continue;
    const tipo = kindOf(p);
    const street = p.street ? `${p.street}${p.housenumber ? `, ${p.housenumber}` : ""}` : "";
    const nome = p.name ?? street;
    if (!nome) continue;
    const bairro = p.district ?? p.locality;
    const detalhe = [nome === street ? "" : street, bairro !== nome ? bairro : "", p.city !== nome ? p.city : "", tipo === "cep" ? "" : p.postcode]
      .filter(Boolean)
      .join(", ");
    const key = `${nome}|${detalhe}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: `${p.osm_type ?? "x"}${p.osm_id ?? out.length}`, nome, detalhe, tipo, lngLat });
  }
  return out;
}

/** Categorias do "Buscar por perto" (rótulo, ícone e a etiqueta do OpenStreetMap que o Photon filtra). */
export const NEARBY = {
  shopping: { nome: "Shopping centers", icone: "🛍️", tag: "shop:mall" },
  farmacia: { nome: "Farmácias", icone: "💊", tag: "amenity:pharmacy" },
  restaurante: { nome: "Restaurantes", icone: "🍴", tag: "amenity:restaurant" },
} as const;
export type NearbyKind = keyof typeof NEARBY;
export const isNearbyKind = (k: string | null): k is NearbyKind => k !== null && Object.hasOwn(NEARBY, k);

/** Raio do "perto", em km. Um ponto da vista do mapa, arredondado a ~1 km — nunca a posição do GPS. */
export const NEARBY_RADIUS_KM = 2;

export function photonNearbyUrl(kind: NearbyKind, near: LngLat, limit = 8, base = PHOTON_BASE) {
  const u = new URLSearchParams({
    lat: near[1].toFixed(2),
    lon: near[0].toFixed(2),
    radius: String(NEARBY_RADIUS_KM),
    limit: String(limit),
    lang: "default",
    osm_tag: NEARBY[kind].tag,
  });
  return `${base}/reverse?${u}`;
}
