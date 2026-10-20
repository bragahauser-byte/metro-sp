// Estilo do mapa de fundo (MapLibre) no espírito do Live Subway Map: quase monocromático, ruas
// largas e claras de perto, parques em verde pálido, nomes de rua em serifa cinza. Sem POIs.
// Tiles vetoriais: OpenFreeMap (esquema OpenMapTiles, dados © OpenStreetMap contributors).
import type { StyleSpecification } from "maplibre-gl";

export type Theme = "light" | "dark";

const PALETTE = {
  light: {
    land: "#f6f6f6",
    water: "#e1e6e9",
    park: "#e2efdc",
    road: "#dfe4e7",
    roadLabel: "#9aa1a5",
    place: "#111111",
    placeHalo: "#f6f6f6",
    neighbourhood: "#8a8f93",
  },
  dark: {
    land: "#000000",
    water: "#262829",
    park: "#0d1710",
    road: "#1d1f20",
    roadLabel: "#6e7377",
    place: "#f2f2f2",
    placeHalo: "#000000",
    neighbourhood: "#77797b",
  },
} as const;

// Fontes servidas pelo Google Fonts (OFL), lidas direto pelo MapLibre via `font-faces`.
const LATIN = [
  "U+0000-00FF", "U+0131", "U+0152-0153", "U+02BB-02BC", "U+02C6", "U+02DA", "U+02DC", "U+0304",
  "U+0308", "U+0329", "U+2000-206F", "U+20AC", "U+2122", "U+2191", "U+2193", "U+2212", "U+2215",
  "U+FEFF", "U+FFFD",
];
const SERIF = "Source Serif 4 Regular";
const SANS_BOLD = "Inter Bold";

const zoomRamp = (stops: [number, number][]) =>
  ["interpolate", ["exponential", 1.6], ["zoom"], ...stops.flat()] as unknown as number;

export function basemapStyle(theme: Theme): StyleSpecification {
  const c = PALETTE[theme];
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    "font-faces": {
      [SERIF]: [
        {
          url: "https://fonts.gstatic.com/s/sourceserif4/v15/vEFy2_tTDB4M7-auWDN0ahZJW3IX2ih5nk3AucvUHf6OAVIJmeUDygwjihdqnhtdDg.woff2",
          "unicode-range": LATIN,
        },
      ],
      [SANS_BOLD]: [
        {
          url: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hiA.woff2",
          "unicode-range": LATIN,
        },
      ],
    },
    sources: {
      omt: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
    },
    layers: [
      { id: "terra", type: "background", paint: { "background-color": c.land } },
      {
        id: "parques",
        type: "fill",
        source: "omt",
        "source-layer": "park",
        paint: { "fill-color": c.park },
      },
      {
        id: "verde",
        type: "fill",
        source: "omt",
        "source-layer": "landuse",
        filter: ["in", ["get", "class"], ["literal", ["cemetery", "stadium", "pitch"]]],
        paint: { "fill-color": c.park, "fill-opacity": 0.7 },
      },
      {
        id: "agua",
        type: "fill",
        source: "omt",
        "source-layer": "water",
        paint: { "fill-color": c.water },
      },
      {
        id: "rios",
        type: "line",
        source: "omt",
        "source-layer": "waterway",
        paint: { "line-color": c.water, "line-width": zoomRamp([[10, 0.5], [15, 3]]) },
      },
      {
        id: "ruas-locais",
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        minzoom: 13,
        filter: ["in", ["get", "class"], ["literal", ["minor", "service"]]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": c.road, "line-width": zoomRamp([[13, 0.5], [15, 3], [17, 11]]) },
      },
      {
        id: "ruas-medias",
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        minzoom: 11,
        filter: ["in", ["get", "class"], ["literal", ["secondary", "tertiary"]]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": c.road, "line-width": zoomRamp([[11, 0.4], [13, 1.4], [15, 5], [17, 14]]) },
      },
      {
        id: "avenidas",
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        minzoom: 9,
        filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary"]]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": c.road, "line-width": zoomRamp([[9, 0.5], [13, 2], [15, 6], [17, 17]]) },
      },
      {
        id: "nomes-de-rua",
        type: "symbol",
        source: "omt",
        "source-layer": "transportation_name",
        minzoom: 15,
        layout: {
          "symbol-placement": "line",
          "text-field": ["get", "name"],
          "text-font": [SERIF],
          "text-size": zoomRamp([[15, 11], [17, 14]]),
          "text-letter-spacing": 0.02,
        },
        paint: { "text-color": c.roadLabel },
      },
      {
        id: "bairros",
        type: "symbol",
        source: "omt",
        "source-layer": "place",
        minzoom: 13.5,
        filter: ["in", ["get", "class"], ["literal", ["suburb", "neighbourhood", "quarter"]]],
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 11,
        },
        paint: { "text-color": c.neighbourhood },
      },
      {
        id: "cidades",
        type: "symbol",
        source: "omt",
        "source-layer": "place",
        maxzoom: 12.5,
        // "São Paulo" cairia em cima da rede no centro; as cidades vizinhas ajudam a se localizar.
        filter: ["all", ["in", ["get", "class"], ["literal", ["city", "town"]]], ["!=", ["get", "name"], "São Paulo"]],
        layout: {
          "text-field": ["get", "name"],
          "text-font": [SANS_BOLD],
          "text-size": zoomRamp([[8, 13], [12, 18]]),
        },
        paint: { "text-color": c.place, "text-halo-color": c.placeHalo, "text-halo-width": 2 },
      },
    ],
  };
}
