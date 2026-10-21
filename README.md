# metro-sp

Site conceitual e não oficial sobre a rede de metrô e trens de São Paulo — projeto de design/portfólio. Mapa vivo entre o diagrama e a geografia, rotas com horários oficiais, acessibilidade e voz.

**No ar:** https://metro-sp-beta.vercel.app · [mapa](https://metro-sp-beta.vercel.app/mapa) · [como chegar](https://metro-sp-beta.vercel.app/rota) · [linhas](https://metro-sp-beta.vercel.app/linhas) · [perto de mim](https://metro-sp-beta.vercel.app/perto-de-mim) · [estilo](https://metro-sp-beta.vercel.app/estilo)

Projeto conceitual independente, sem vínculo com a Companhia do Metropolitano de São Paulo. Informações oficiais em [metro.sp.gov.br](https://www.metro.sp.gov.br).

## O que tem

- **Mapa** esquemático (45°/90°) e real, no espírito do Live Subway Map da MTA, com zoom semântico.
- **Como chegar:** origem e destino por texto (sem acento) ou voz, alternativas, sair agora / sair às / chegar até, viabilidade pelos horários oficiais (fechamento de cada estação, baldeações até 0h00, integrações com horário próprio), prioridade a estações acessíveis e leitura da rota em voz alta.
- **Avisos:** comunicados oficiais do feed RSS do Metrô (no máximo a cada 30 min, com data e fonte) — nunca apresentados como situação em tempo real.
- **Acessibilidade:** alvos de 48 px, foco gerenciado, anúncios para leitor de tela, alternativa em texto do mapa, tema Claro/Escuro/Sistema, texto maior, mais contraste e reduzir movimento.

## Rodar

```bash
npm install
npm run dev
npm test        # motor de rotas, horários, voz e avisos (node --test)
```

Dados: `npm run data:fetch` → `npm run data:build` → `npm run data:schematic` → `npm run validate` (fontes em [`data/sources.md`](data/sources.md)). Horários oficiais em [`data/horarios.json`](data/horarios.json).

### Variáveis de ambiente (opcionais)

| Nome | Para quê |
|---|---|
| `CRON_SECRET` | Libera `GET /api/avisos/atualizar` (força nova coleta de avisos). Sem ela, o endpoint responde 503; os avisos continuam se atualizando sozinhos a cada 30 min. |

Stack: Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind CSS 4 + MapLibre GL (só no modo real). Regras do projeto em [`CLAUDE.md`](CLAUDE.md); inventário de referências em [`docs/inventario.md`](docs/inventario.md).
