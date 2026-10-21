// Onde o site está rodando. Na Vercel há funções de servidor (/api); no GitHub Pages o site é
// estático, servido em /metro-sp/, e o que depende de servidor fica desligado com aviso.

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const IS_STATIC = process.env.NEXT_PUBLIC_DEPLOY_TARGET === "pages";
export const FULL_SITE_URL = "https://metro-sp-beta.vercel.app";

/** Caminho com o prefixo do site (para fetch e arquivos em /public; o <Link> já aplica sozinho). */
export const withBase = (path: string) => `${BASE_PATH}${path}`;
