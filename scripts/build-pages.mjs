// Build estático para o GitHub Pages (https://bragahauser-byte.github.io/metro-sp/).
// O Pages não roda funções: a pasta app/api (avisos, geocodificação) e a imagem de compartilhamento
// gerada no servidor saem do build e voltam no fim, mesmo se o build falhar.
// O site estático sabe disso (lib/env.ts) e avisa onde algo depende de
// servidor. Saída em out/.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";

const PARKED = ".fora-do-build-pages";
const MOVES = [
  ["app/api", `${PARKED}/api`],
  ["app/opengraph-image.tsx", `${PARKED}/opengraph-image.tsx`],
];

if (existsSync(PARKED)) {
  console.error(`${PARKED} já existe — um build anterior foi interrompido. Devolva os arquivos para app/ e rode de novo.`);
  process.exit(1);
}

mkdirSync(PARKED);
for (const [from, to] of MOVES) renameSync(from, to);
let status = 1;
try {
  const r = spawnSync("npx", ["next", "build"], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, DEPLOY_TARGET: "pages" },
  });
  status = r.status ?? 1;
} finally {
  for (const [from, to] of MOVES) renameSync(to, from);
  rmSync(PARKED, { recursive: true });
}
if (status === 0) {
  // Sem Jekyll: as pastas que começam com "_" (como _next) precisam ser servidas como estão.
  writeFileSync("out/.nojekyll", "");
}
process.exit(status);
