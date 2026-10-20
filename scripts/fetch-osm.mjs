// Baixa do OpenStreetMap (Overpass) as relações de rota das linhas e as paradas.
// Saída: data/raw/osm.json (ignorado no git). Dados © OpenStreetMap contributors, ODbL.
// Uso: node scripts/fetch-osm.mjs
import { mkdir, writeFile } from "node:fs/promises";

import { EXTRA_STATION_NODES, ROUTE_RELATIONS } from "./osm-config.mjs";

const ENDPOINT = "https://overpass-api.de/api/interpreter";
const ids = Object.values(ROUTE_RELATIONS).flat().join(",");
const query = `[out:json][timeout:180];
rel(id:${ids})->.r;
.r out body geom;
node(r.r)->.n;
.n out body;
rel(bn.n)["public_transport"="stop_area"];
out body;
node(id:${Object.values(EXTRA_STATION_NODES).flat().join(",")});
out body;
(
  way["railway"="monorail"](-23.66,-46.73,-23.59,-46.64);
  way["railway"="monorail"](-23.61,-46.50,-23.58,-46.46);
  way["name"~"^Linha 6"]["railway"](-23.58,-46.72,-23.45,-46.62);
);
out tags geom;`;

// O Overpass público devolve 429/502/504 quando está cheio: tenta de novo com espera crescente.
async function overpass(data, tries = 5) {
  for (let i = 1; ; i++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": "metro-sp-conceitual/0.1 (github.com/bragahauser-byte/metro-sp)",
      },
      body: new URLSearchParams({ data }),
    });
    if (res.ok) return res.json();
    if (i >= tries) throw new Error(`Overpass respondeu ${res.status}`);
    console.warn(`Overpass ${res.status}, tentativa ${i}/${tries}`);
    await new Promise((r) => setTimeout(r, 20_000 * i));
  }
}

const json = await overpass(query);

await mkdir(new URL("../data/raw/", import.meta.url), { recursive: true });
await writeFile(new URL("../data/raw/osm.json", import.meta.url), JSON.stringify(json));
console.log(`osm.json: ${json.elements.length} elementos, base de ${json.osm3s.timestamp_osm_base}`);
