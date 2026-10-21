// Nominatim (OpenStreetMap), só no servidor e só como reforço do Photon: a política proíbe
// autocomplete no navegador e pede no máximo 1 requisição por segundo, User-Agent identificável
// e cache. https://operations.osmfoundation.org/policies/nominatim/
import { RMSP_BBOX, inArea } from "./area.ts";
import type { Place, PlaceKind } from "./photon.ts";
import type { LngLat } from "./walk.ts";

export const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

export function nominatimUrl(q: string, limit = 6, base = NOMINATIM_BASE) {
  const [w, s, e, n] = RMSP_BBOX;
  const u = new URLSearchParams({
    q: q.trim(),
    format: "jsonv2",
    limit: String(limit),
    countrycodes: "br",
    viewbox: `${w},${n},${e},${s}`,
    bounded: "1",
    addressdetails: "1",
    "accept-language": "pt-BR",
  });
  return `${base}/search?${u}`;
}

type NomAddress = { road?: string; house_number?: string; suburb?: string; neighbourhood?: string; city_district?: string; city?: string; town?: string; postcode?: string };
type NomItem = { osm_type?: string; osm_id?: number; lat?: string; lon?: string; name?: string; category?: string; type?: string; addresstype?: string; address?: NomAddress };

function kindOf(i: NomItem): PlaceKind {
  if (i.type === "postcode") return "cep";
  if (i.addresstype === "road" || i.category === "highway") return "rua";
  if (i.category === "place" && (i.type === "house" || i.type === "house_number")) return "endereco";
  if (i.category === "place" && /suburb|quarter|neighbourhood/.test(i.type ?? "")) return "bairro";
  if (i.category === "boundary" || i.type === "city" || i.type === "town") return "cidade";
  return "lugar";
}

/** Resposta do Nominatim → lugares, só dentro da Grande São Paulo e sem estações (essas são nossas). */
export function parseNominatim(json: unknown): Place[] {
  if (!Array.isArray(json)) return [];
  const out: Place[] = [];
  for (const i of json as NomItem[]) {
    const lngLat: LngLat = [Number(i.lon), Number(i.lat)];
    if (!lngLat.every(Number.isFinite) || !inArea(lngLat)) continue;
    if (i.category === "railway") continue;
    const a = i.address ?? {};
    const street = a.road ? `${a.road}${a.house_number ? `, ${a.house_number}` : ""}` : "";
    const tipo = kindOf(i);
    const nome = i.name || street || (tipo === "cep" ? (a.postcode ?? "") : "");
    if (!nome) continue;
    const bairro = a.suburb ?? a.neighbourhood ?? a.city_district;
    const cidade = a.city ?? a.town;
    const detalhe = [nome === street ? "" : street, bairro !== nome ? bairro : "", cidade !== nome ? cidade : "", tipo === "cep" ? "" : a.postcode]
      .filter(Boolean)
      .join(", ");
    out.push({ id: `nom-${i.osm_type ?? "x"}${i.osm_id ?? out.length}`, nome, detalhe, tipo, lngLat });
  }
  return out;
}
