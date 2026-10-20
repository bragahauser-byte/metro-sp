# metro-sp

Site conceitual e não oficial sobre a rede de metrô de São Paulo — projeto de design/portfólio.

**No ar:** https://metro-sp-beta.vercel.app · [mapa](https://metro-sp-beta.vercel.app/mapa) · [linhas](https://metro-sp-beta.vercel.app/linhas) · [perto de mim](https://metro-sp-beta.vercel.app/perto-de-mim)

Projeto conceitual independente, sem vínculo com a Companhia do Metropolitano de São Paulo. Informações oficiais em [metro.sp.gov.br](https://www.metro.sp.gov.br).

## Rodar

```bash
npm install
npm run dev
```

Dados: `npm run data:fetch` → `npm run data:build` → `npm run data:schematic` → `npm run validate` (fontes em [`data/sources.md`](data/sources.md)).

Stack: Next.js (App Router) + TypeScript + Tailwind CSS. Regras do projeto em [`CLAUDE.md`](CLAUDE.md); inventário de referências em [`docs/inventario.md`](docs/inventario.md).
