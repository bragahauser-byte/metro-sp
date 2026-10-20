// Copia o worker do MapLibre 6 para /public (ele é carregado à parte, via setWorkerUrl).
// Roda em predev/prebuild; o arquivo copiado fica fora do git.
import { copyFile, mkdir } from "node:fs/promises";

const from = new URL("../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url);
const dir = new URL("../public/vendor/", import.meta.url);
await mkdir(dir, { recursive: true });
await copyFile(from, new URL("maplibre-gl-worker.mjs", dir));
