# Projeto "Metrô SP" (site conceitual)

Este arquivo fica na raiz do repositório. Leia-o no início de toda sessão e siga-o sempre.

## O que é este projeto

Um site conceitual e não oficial sobre a rede de metrô de São Paulo, feito como projeto de design/portfólio por Malu (github.com/bragahauser-byte). Foco: interface excepcional, responsiva, com mapa interativo, geolocalização (GPS), linguagem visual do modernismo paulista e minimalismo.

- Não é o site oficial e não deve se passar por ele. Rodapé fixo em todas as páginas: "Projeto conceitual independente, sem vínculo com a Companhia do Metropolitano de São Paulo. Informações oficiais em metro.sp.gov.br."
- Nome do site: **"Metrô" + selo BETA** (decisão de 20/10/2026), sempre acompanhado do aviso de projeto não oficial. Não usar o domínio oficial nem o logotipo/símbolo oficial; o nome aparece só em texto. Referências à identidade histórica (cores de linha, grid, tipografia de inspiração suíça) são homenagem/estudo, não cópia da marca.

## Referência visual principal

A referência de interface é o **Live Subway Map da MTA (Work & Co, 2020)** — imagens em `_referencias/imagens do projeto/`. Ver o resumo em `docs/inventario.md`.

## Stack

- Next.js (App Router) + TypeScript (strict) + Tailwind CSS
- MapLibre GL JS para o mapa geográfico (tiles gratuitos, ex.: OpenFreeMap ou Protomaps — sem chave paga)
- SVG próprio para o diagrama esquemático
- Motion (Framer Motion) para animações; respeitar `prefers-reduced-motion`
- Dados estáticos versionados em `/data` (JSON/GeoJSON), gerados por scripts em `/scripts`
- Deploy: Vercel conectado ao GitHub (push na main = deploy de produção; branches = preview)

## Estrutura de pastas

```
/app            / é o mapa; /estilo; /mapa, /linhas, /estacoes, /rota, /como-chegar, /perto-de-mim, /sobre só redirecionam; /api (avisos, geocode)
/components     UI (map/, diagram/, ui/)
/data           lines.json, stations.geojson, edges.json, sources.md
/scripts        coleta/normalização de dados (Overpass/OSM, GeoSampa)
/styles         tokens de design
/docs           inventário e decisões de design
/_referencias   material de referência local — NO .gitignore, nunca commitar
```

## Regras de design

- Grid modular rígido (inspiração Cauduro/Martino e escola suíça), muito espaço em branco, hierarquia tipográfica forte, poucos elementos.
- Cores de linha são tokens semânticos (`--line-1` … `--line-17`); os hex vêm do Guia Rápido em `_referencias/` (ver `docs/inventario.md`). Nunca inventar cor de linha.
- Direção visual fechada (20/10/2026): **"Mapa vivo"** — cartões flutuantes com sombra mínima, cantos arredondados, curvas suaves, badges circulares. Tokens em `styles/tokens.css`, vitrine em `/estilo`.
- **Fidelidade às referências (exigência da dona do projeto, 20/10/2026):** a aparência deve ser igual às imagens de `_referencias/imagens do projeto` (Live Subway Map da MTA): formato e largura das linhas, faixas paralelas com fio branco entre elas quando várias linhas correm juntas, cortes a 90° e 45° com curvas de raio constante, estações como pontos pretos com rótulo da linha, transferências como fio preto fino, e zoom semântico (de longe: linhas finas; de perto: faixas largas, nomes de rua em serifa cinza). Paleta de linhas idêntica ao Guia Rápido (`data/line-colors.json`). O mapa real tem de estar geograficamente correto (`data/tracks.geojson`).
- Ícones de linha: círculo na cor da linha com o número **sempre branco** e centralizado (decisão de 20/10/2026). Como algumas cores claras não chegam a 4,5:1, o ícone nunca pode ser a única informação: sempre com `aria-label` e com o nome da linha escrito por perto.
- Tipografia: **Inter** (OFL) via `next/font`. Helvetica Now (em `_referencias/tipografia projeto`) é comercial — NÃO commitar.
- Escala tipográfica fechada (v1.2): só `text-xs` 12/16 (+0,1 px), `text-sm` 14/20, `text-base` 16/24, `text-lg` 20/28 (−0,2), `text-xl` 24/32 (−0,4) e `text-2xl` 28/36 (−0,5); pesos 400/500/600/700. Os tamanhos padrão do Tailwind estão desligados em `styles/tokens.css`. Nada abaixo de 12 px (também nos rótulos do canvas). Não usar `tracking-*`/`leading-*` avulsos: o espaçamento vem do token.
- Cores de texto semânticas: `text-fg`, `text-fg-muted`, `text-fg-link`, `text-fg-success`, `text-fg-warning`, `text-fg-danger`, `text-fg-disabled` (`ink`/`ink-muted` continuam como apelidos).
- Controles: área mínima de 48 × 48 px (`size-control`, `h-control`); ícones de 24 px (`size-icon`). Usar `Button`/`IconButton`/`Icons` de `components/ui/button.tsx`.
- Preferências (`lib/prefs.ts`, diálogo no ícone de ajustes): tema Claro/Escuro/Sistema (nunca automático por horário), texto maior, mais contraste, reduzir movimento, voz e sons. Viram atributos `data-*` no `<html>`, aplicados antes da pintura pelo script do layout.
- Mobile-first. Testar em 360px, 768px, 1280px e 1920px.
- Acessibilidade WCAG AA: contraste, foco visível, navegação por teclado, e toda informação do mapa também disponível em lista (o mapa nunca é o único caminho).
- Dark mode e light mode.

## Arquitetura do mapa

- **Map-first (v1.3, 20/10/2026):** o site abre direto no mapa em `/` (sem landing, sem menu no topo), com abertura curta (`components/map/splash.tsx`) só até o mapa ficar pronto (`onReady` do `SubwayMap`). Modo **Real é o padrão sempre**; esquemático só com `?modo=esquematico`. Sobre/Fontes/Estilo ficam no diálogo de ajustes (`theme-toggle.tsx`) e no painel `sobre`. Rotas antigas redirecionam (308 em `next.config.ts` na Vercel; `components/map-redirect.tsx` no Pages).
- No modo esquemático a câmera é própria e leve (`components/map/camera.ts`, mesma projeção do MapLibre); o MapLibre só é baixado ao abrir o modo real e assume a mesma vista. Isso mantém o Lighthouse mobile ≥ 90 — não importar `maplibre-gl` de forma estática nem o CSS completo dele (usar `maplibre-min.css`). MapLibre só para o fundo de ruas; linhas, estações e rótulos são desenhados em canvas por `components/map/network-renderer.ts` (faixas paralelas, largura por zoom, curvas de raio constante, rótulos com colisão). A transição esquemático ↔ real interpola cada estação (`t` de 0 a 1).
- Nível de detalhe por zoom (como no Live Subway Map): longe = linhas finas em troncos; médio = pontos e nomes de baldeações/terminais; perto = todos os nomes com ícones das linhas e ♿, e cada linha vira um par de faixas (ida e volta) com fio branco; máximo = número da linha ao lado do ponto e entradas. Linha selecionada: as outras ficam cinza. Trecho em obras: acinzentado, estação vazada.
- Planejador de rota (`lib/route/engine.ts`, ligado em `components/route/plan.ts`): Dijkstra sobre (estação, linha), tempo estimado pela distância do traçado (35 km/h metrô, 30 monotrilho, 45 trem, 30 s por parada) + 5 min por baldeação; sempre apresentado como estimativa. `/rota?de=&para=` e `/mapa?de=&para=`.
- Imagem de compartilhamento só da raiz (`app/opengraph-image.tsx`, fonte Inter em `assets/fonts`, OFL; fora do build do Pages); `public/sitemap.xml` e `public/robots.txt` com o domínio https://metro-sp-beta.vercel.app.
- Endereço guarda modo, linha, estação e a vista (`?v=lng,lat,zoom`), mas nunca quando o GPS está ativo.
- O worker do MapLibre 6 é copiado para `public/vendor` em `predev`/`prebuild` (fora do git).
- Fontes do mapa de fundo via `font-faces` do estilo (Google Fonts, OFL); tiles do OpenFreeMap.
- **Celular (v1.4, 21/10/2026, referência `_referencias/imagens do projeto/detalhes visuais importantes/mobile`):** sem folha com o painel fechado — símbolo "M" (abre ajustes) + nome no alto; embaixo botão de linhas (pontos coloridos), pílula Agora e "!"; à direita busca (no lugar do ♿ da referência) e localização. A busca (`components/search/find-view.tsx`) segue `search.jpeg` (Apple Maps): campo + fechar, Recentes, Buscar por perto.
- Folha do celular (`components/map/bottom-sheet.tsx`): só com painel aberto, estados recolhido/meio/expandido; arrastar só pela alça/cabeçalho, muda por distância (48 px) ou velocidade (0,5 px/ms). Painel aberto = uma entrada no histórico (o voltar do aparelho fecha); Esc volta um nível; o foco volta para quem abriu (`map-app.tsx`). O conteúdo do painel é renderizado uma vez só (cartão no desktop ou folha no celular).
- Busca (`components/route/route-planner.tsx` + `components/search/`): origem/destino podem ser estação ou lugar (`Spot`); lugares via Photon (`/api/geocode` na Vercel, direto no Pages), com apelidos (`lib/geo/aliases.ts`: MASP, Allianz Parque → Nubank Parque), CEP sem traço, ordenação por nome e distância (`lib/geo/rank.ts`) e, só no servidor, Nominatim de reforço (1 req/s, cache 1 dia; `lib/geo/nominatim.ts`). Passo a passo da rota em `lib/route/steps.ts` (puro) + `components/route/route-steps.tsx` (toque no passo → mapa). Rota de porta a porta em `lib/geo/place-route.ts`; caminhada é sempre estimativa (`lib/geo/walk.ts`).
- GitHub Pages: `npm run build:pages` (`DEPLOY_TARGET=pages`, base `/metro-sp/`, `output: export`, sem `/api` nem OG; `lib/env.ts` diz ao cliente que é estático). Workflow `.github/workflows/pages.yml`.

## Domínio (lib/, sem React — testável com `npm test`)

- `lib/route/engine.ts`: motor de rotas puro (Dijkstra com heap sobre nós `slug|linha`), alternativas (menos baldeações; evitando cada linha da melhor), junta rotas que só trocam linha paralela ("ou Linha 11"), preferência de acessibilidade (prioriza, não exclui), checagem de horário por embarque e baldeação e replanejamento quando uma baldeação está fechada. `components/route/plan.ts` liga o motor aos dados.
- `lib/schedule/hours.ts` + `data/horarios.json`: horários SÓ de fonte oficial consultada. Sem dado = `nao-verificado` (nunca supor aberto/fechado). Regras do Metrô não se estendem a outras operadoras. "Inviável" só com confirmação da fonte.
- `lib/time/sao-paulo.ts`: fuso America/Sao_Paulo via Intl, dia de operação (até 3h conta como o dia anterior), feriados (nacionais, estadual, municipais; Carnaval não).
- `lib/ops/`: avisos e situação das linhas. Comunicados por RSS; situação (`status.ts`) pela CPTM (JSON público) e ARTESP (`ARTESP_API_KEY`); TemTrem só link (termos proíbem automação). Tudo registrado em `sources.ts` + `data/sources.md`. `/api/avisos` usa `use cache` + `cacheLife` (15 min) e o cliente repete a cada 15 min (`components/ops/use-ops.ts`) — no plano Hobby o cron da Vercel é diário. `/api/avisos/atualizar` força nova coleta e exige `CRON_SECRET` (variável de ambiente na Vercel; sem ela responde 503). Comunicado ≠ situação em tempo real.
- `lib/voice/`: entender "da estação X até Y" (sem acento, com tolerância a erro) e descrever a rota em frases. Reconhecimento e fala usam a Web Speech API do navegador (`components/voice/`), com o texto sempre como alternativa.
- `lib/geo/`: caminhada (haversine × 1,3 a 4,5 km/h), estações candidatas (3 mais perto em 2 → 3,5 → 5 km), melhor combinação embarque × desembarque, conversão da resposta do Photon e busca mista com tempo-limite.
- Testes: `npm test` (node --test com remoção de tipos do Node ≥ 22.6; imports relativos com extensão `.ts` em `lib/` e `tests/`).

## Regras de dados

- Toda informação factual (estações, linhas, status de operação, integrações) precisa de fonte registrada em `/data/sources.md` com data de consulta.
- A rede muda: em 2026 entraram a Linha 17-Ouro (monotrilho, operação provisória) e o primeiro trecho da Linha 6-Laranja (6 estações, operação assistida). Modele status por linha e por estação: `operando | operacao-assistida | em-obras | planejada`.
- Dados do OpenStreetMap exigem atribuição ODbL ("© OpenStreetMap contributors") no mapa e na página Sobre.
- Não fazer scraping de endpoints oficiais sem verificar termos de uso; status em tempo real só com fonte que permita.

## Geolocalização

- **Mudou em 21/10/2026 (pedido da dona do projeto, v1.5):** o site pede a localização assim que abre, depois de um aviso curto ("Para traçar sua rota, o Metrô SP usa sua localização. Ela não sai do seu aparelho."). Já negada: não insiste; o botão "Usar minha localização" explica como liberar. Estado único em `components/geo/location.ts`; `watchPosition` só com rota ativa saindo de "Sua localização".
- Localização é processada só no navegador; nunca enviar a servidor, salvar ou logar.
- Tratar negação/erro/timeout com mensagem clara e alternativa (buscar estação por nome).
- Com GPS ativo, a busca não manda viés ao servidor (ordena pela sua posição só no aparelho); "Buscar por perto" com o mapa em cima de você pede confirmação antes de mandar o centro do mapa (~1 km).

## Fluxo de trabalho Git + Vercel (obrigatório)

Trabalhe em passos pequenos. Ao final de cada passo concluído:

1. `npm run lint`, `npx tsc --noEmit`, `npm test` e `npm run build` — só siga se tudo passar.
2. Commit com mensagem clara em português (ex.: `feat(mapa): diagrama esquemático com linhas 1 a 5`).
3. `git push` para `origin main` (ou para a branch da fase, se estivermos usando branch).
4. Depois do push, informe: o que mudou, o hash do commit e que a Vercel vai publicar automaticamente. Se a Vercel CLI estiver disponível e linkada, confira o status com `vercel ls`/`vercel inspect` e passe a URL.

- Nunca commitar: `.env*`, chaves, `_referencias/`, fontes comerciais, `node_modules`.
- Nunca usar `git push --force` na main.
- Se um build falhar na Vercel, corrigir antes de qualquer feature nova.

## Como trabalhar comigo

- Antes de cada fase grande, mostre um plano curto e espere meu ok.
- Use a extensão Claude in Chrome para pesquisar fontes e para conferir o site no navegador (localhost e URL da Vercel), incluindo tamanhos de tela mobile.
- Quando tiver dúvida de design, apresente 2–3 opções visuais em vez de escolher às cegas.
