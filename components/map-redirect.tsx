"use client";

import { useEffect } from "react";
import { withBase } from "@/lib/env";

/**
 * Endereços antigos (/mapa, /linhas, /rota, /sobre…) levam ao mapa com o painel certo aberto.
 * Na Vercel o servidor já redireciona (next.config.ts); isto cobre o GitHub Pages, que é estático:
 * redireciona no navegador mantendo os parâmetros (?de=&para=…) e, sem JavaScript, pelo <meta>.
 */
export function MapRedirect({ params = {} }: { params?: Record<string, string> }) {
  const fixed = new URLSearchParams(params).toString();
  const target = withBase(`/${fixed ? `?${fixed}` : ""}`);
  useEffect(() => {
    const u = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(params)) u.set(k, v);
    const qs = u.toString();
    window.location.replace(withBase(`/${qs ? `?${qs}` : ""}`));
  }, [params]);
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
      <meta httpEquiv="refresh" content={`0; url=${target}`} />
      <p className="text-base">Abrindo o mapa…</p>
      <a className="text-base font-semibold underline" href={target}>
        Ir para o mapa
      </a>
    </main>
  );
}
