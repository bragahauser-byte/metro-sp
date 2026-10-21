# Metrô (beta)

Site conceitual de design sobre a rede sobre trilhos de São Paulo. Abre direto no mapa, como o Google Maps e o Apple Maps: traçado real por padrão (o esquemático continua como opção), busca por estação, endereço, rua, CEP ou lugar, rota de porta a porta com os trechos a pé, horários oficiais quando existem, acessibilidade e voz.

**No ar:**

- Versão completa (Vercel): https://metro-sp-beta.vercel.app
- Versão estática (GitHub Pages): https://bragahauser-byte.github.io/metro-sp/

Projeto conceitual independente, sem vínculo com a Companhia do Metropolitano de São Paulo. Informações oficiais em [metro.sp.gov.br](https://www.metro.sp.gov.br).

## O que tem

- **Mapa em tela cheia** com abertura curta (só enquanto carrega). Painel flutuante compacto: modo do mapa (Real / Esquemático), linhas, interruptor dos trens metropolitanos (7 a 13) e o botão de busca. No celular, folha com três estados (recolhida, meio, expandida), arrastável; Esc e o botão voltar fecham e o foco volta para quem abriu.
- **Busca por qualquer lugar:** estações (na hora, sem rede) e lugares/endereços (Photon, OpenStreetMap), com tipo, nome e endereço em cada resultado; setas, Enter e Esc; restrita à Grande São Paulo e com viés pela vista do mapa.
- **Rota de porta a porta:** para cada ponta que é um lugar, as 3 estações mais próximas (2 km, ampliando para 3,5 e 5 km); escolhe a combinação de menor tempo total (a pé + rede + a pé). Caminhada sempre rotulada como estimativa (linha reta × 1,3 a 4,5 km/h). No mapa: marcadores de origem e destino e o trecho a pé tracejado. Lugar a mais de 5 km de qualquer estação: o site diz que não dá, em vez de inventar.
- **Horários:** só de fonte oficial consultada (Metrô; Motiva para 4, 5, 8 e 9). Sem fonte = "horário não verificado", nunca tratado como aberto.
- **Avisos:** comunicados do feed RSS do Metrô, com cache de 30 min e última atualização bem-sucedida separada da data de cada comunicado.
- **Voz:** dizer a rota ("de Rua Otávio Alves Dundas até Shopping Eldorado"), com confirmação quando há mais de um lugar possível; ouvir a rota com tocar, pausar, continuar e parar; bipe opcional (nunca o único aviso).
- **Acessibilidade:** alvos de 48 px, foco gerenciado, anúncios para leitor de tela, alternativa em texto do mapa, tema Claro/Escuro/Sistema, texto maior, mais contraste e reduzir movimento (no ícone de ajustes, junto com Sobre, fontes e Estilo).

Endereços antigos continuam funcionando: `/mapa`, `/linhas`, `/linhas/4`, `/estacoes/se`, `/rota`, `/como-chegar`, `/perto-de-mim` e `/sobre` levam ao mapa com o painel certo aberto.

## Rodar, testar e buildar

```bash
npm install
npm run dev            # http://localhost:3000
npm test               # node --test: rotas, horários, avisos, voz, geocodificação, caminhada (Node ≥ 22.6)
npm run lint
npx next typegen && npx tsc --noEmit
npm run build          # build da Vercel (com /api)
npm run build:pages    # build estático do GitHub Pages em out/ (base /metro-sp/)
```

Dados: `npm run data:fetch` → `npm run data:build` → `npm run data:schematic` → `npm run validate`. Fontes e datas em [`data/sources.md`](data/sources.md); horários em [`data/horarios.json`](data/horarios.json).

## Variáveis de ambiente

Nenhuma é obrigatória. A geocodificação (Photon) não usa chave.

| Nome | Onde | Para quê |
|---|---|---|
| `CRON_SECRET` | Vercel (Settings → Environment Variables) | Libera `GET /api/avisos/atualizar` com `Authorization: Bearer <segredo>` (força nova coleta de avisos). Sem ela o endpoint responde 503; os avisos continuam se atualizando sozinhos a cada 30 min. |
| `DEPLOY_TARGET=pages` | só no build | Usado por `npm run build:pages`; não configure na Vercel. |

## Geocodificação

Provedor: **[Photon](https://photon.komoot.io)** (komoot), baseado no OpenStreetMap. A política dele permite uso em projetos com moderação ("please be fair"), sem chave. O Nominatim ficou de fora porque a política da OSMF proíbe autocomplete e limita a 1 requisição por segundo.

- Vercel: `/api/geocode` faz proxy com cache (CDN 1 dia, memória 1 h), limite por IP (30/min) e teto global (120/min), User-Agent identificável.
- Pages: o navegador chama o Photon direto (CORS liberado), com mínimo de 3 letras, espera de 300 ms e cancelamento das buscas antigas.
- Só o texto digitado é enviado; a localização do GPS nunca. Atribuição "Photon · © OpenStreetMap contributors" aparece nos resultados.

## Vercel × GitHub Pages

| | Vercel | GitHub Pages |
|---|---|---|
| Mapa, linhas, estações, rotas entre estações, horários | sim | sim |
| Busca de endereços e lugares | via `/api/geocode` (cache + limite) | direto no Photon |
| Avisos (comunicados do Metrô) | sim (`/api/avisos`) | não — mostra "disponível na versão completa" |
| Atualização forçada de avisos | `/api/avisos/atualizar` com `CRON_SECRET` | não |
| Endereços antigos | redirecionamento 308 no servidor | redirecionamento no navegador |
| Imagem de compartilhamento (OG) | sim | não |

A versão do Pages mostra o selo "Versão estática — versão completa em metro-sp-beta.vercel.app". Publicação: workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) (testes, lint, tipos e build; se algo falhar, nada é publicado).

Stack: Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind CSS 4 + MapLibre GL. Regras do projeto em [`CLAUDE.md`](CLAUDE.md).
