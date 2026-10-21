# Fontes

Toda informação factual do site precisa de uma linha aqui, com data de consulta.

## Arquivos e como são gerados

| Arquivo | Conteúdo | Gerado por |
|---|---|---|
| `line-colors.json` | Cor e tinta (número) de cada linha | à mão, a partir do Guia Rápido |
| `lines.json` | Linhas: nome, cor, operador, tipo, status, extensão operacional, sequências de estações | `npm run data:build` |
| `stations.geojson` | Estações: nome, complemento, linhas, status (geral e por linha), parada de cada linha | `npm run data:build` |
| `edges.json` | Grafo: trechos estação→estação por linha (distância em m) e transferências | `npm run data:build` |
| `tracks.geojson` | Geometria real de cada trecho (traçado dos trilhos) e `faixa` (posição no feixe de linhas paralelas) | `npm run data:build` |
| `entrances.geojson` | Entradas das estações (OSM), ligadas à estação mais próxima (até 400 m) | `npm run data:build` |
| `schematic.json` | Diagrama esquemático próprio: posição de cada estação e caminho octilinear de cada trecho | `npm run data:schematic` |
| `horarios.json` | Horários oficiais: janelas por tipo de dia, fechamento por estação (Linhas 1–3), regras de transferência, operação especial, com fonte e validade | à mão, a partir das fontes abaixo |

Atualizar: `npm run data:fetch` (baixa do OSM para `data/raw/`, fora do git) → `npm run data:build` → `npm run data:schematic` → `npm run validate`.

## Fontes

| Dado | Fonte | Consulta |
|---|---|---|
| Cores das linhas (RGB/Pantone) | Companhia do Metropolitano de São Paulo, *Guia Rápido — Identidade Visual do Metrô de São Paulo*, REV.2, nov/2022, p. 26 | 20/10/2026 |
| História do símbolo (Cauduro/Martino, 1967) | Idem, p. 7 | 20/10/2026 |
| Lista e ordem das estações por linha, operadores, integrações, nomes e complementos (ex.: "Profª Elisabeth Tenreiro") | Governo do Estado de São Paulo, *Mapa do Transporte Metropolitano*, julho/2026 (`_referencias/mapa-da-rede.pdf`) | 20/10/2026 |
| Traçado dos trilhos, coordenadas das paradas e das estações em obras da Linha 6 | © OpenStreetMap contributors, ODbL — via Overpass API, relações listadas em `scripts/osm-config.mjs` (base OSM de 20/10/2026) | 20/10/2026 |
| Linha 17-Ouro: 8 estações, ramal Brooklin Paulista–Washington Luís ("formato Y"), operação transitória sem cobrança | Metrô, "Governo de SP entrega estação Washington Luís e amplia operação transitória da Linha 17-Ouro do Metrô", 30/06/2026 — https://www.metro.sp.gov.br/2026/06/30/governo-de-sp-entrega-estacao-washington-luis-e-amplia-operacao-transitoria-da-linha-17-ouro-do-metro/ | 20/10/2026 |
| Linha 6-Laranja: 15 estações na ordem Brasilândia–São Joaquim | Linha Uni — https://www.linhauni.com.br | 20/10/2026 |
| Linha 6-Laranja: operação assistida de João Paulo I a Perdizes (6 estações); demais em obras | Agência SP, "Veja o funcionamento do primeiro trecho da Linha 6-Laranja", 01/07/2026; Secretaria de Parcerias em Investimentos, 03/08/2026 | 20/10/2026 |
| Linha 15-Prata até Jardim Colonial | Metrô, notícia de 19/01/2024 sobre alterações nas Linhas 3 e 15 ("de Vila Prudente a Jardim Colonial") | 20/10/2026 |
| Entradas das estações e marca de acessibilidade (wheelchair) | © OpenStreetMap contributors, ODbL — nós railway=subway_entrance/train_station_entrance e railway=station (base OSM de 20/10/2026) | 20/10/2026 |
| Mapa de fundo (ruas, parques, água, nomes de lugares) | OpenFreeMap, tiles vetoriais no esquema OpenMapTiles — dados © OpenStreetMap contributors | 20/10/2026 |
| Fontes do mapa: Source Serif 4 (nomes de rua) e Inter Bold (cidades) | Google Fonts, licença SIL Open Font License | 20/10/2026 |
| Estação São Bento (Linha 1), que faltava na relação de rota do OSM | Lista oficial de estações da Linha 1 em metro.sp.gov.br/sua-viagem/horarios/; nó OSM 5369277944 | 20/10/2026 |
| Horários das Linhas 1, 2, 3, 15 e 17: abertura 4h40, fechamento de cada estação, embarque após 0h só na mesma linha, baldeações (Sé, Paraíso, Ana Rosa, Vila Prudente) até 0h, integrações com outras operadoras (Luz, República, Consolação, Santa Cruz, Chácara Klabin, Palmeiras-Barra Funda, Tamanduateí, Brás, Corinthians-Itaquera, Tatuapé), Linha 17 de segunda a sábado 6h–22h, operação 24 h experimental nas madrugadas de sábado para domingo até jan/2027 | Metrô, *Sua viagem › Horários* — https://www.metro.sp.gov.br/sua-viagem/horarios/ (a página não traz data de atualização) | 20/10/2026 |
| Linha 6-Laranja: operação assistida de segunda a sexta, 10h–15h, por 180 dias a partir de 03/07/2026, gratuita | Prefeitura de São Paulo, notícia de 02/07/2026 — https://prefeitura.sp.gov.br/w/linha-6-laranja-inaugura-nova-fase-para-a-brasil%C3%A2ndia-e-aproxima-a-zona-norte-do-centro-de-s%C3%A3o-paulo | 20/10/2026 |
| Feriados na cidade de São Paulo | Leis federais 662/1949, 6.802/1980 e 14.759/2023; Lei estadual 9.497/1997; Lei municipal 14.485/2007 (Carnaval é ponto facultativo e não entra) | 20/10/2026 |
| Comunicados oficiais (avisos) | Feed RSS público do Metrô — https://www.metro.sp.gov.br/feed/ ; robots.txt permite `/` (bloqueia só a busca) | 20/10/2026 |
| Limites do cron na Vercel (plano Hobby: 1 execução por dia, precisão de ±59 min) | https://vercel.com/docs/cron-jobs/usage-and-pricing (atualizada em 15/07/2026) | 20/10/2026 |

## Observações

- **Status `operacao-assistida`** cobre também a "operação transitória" da Linha 17 (horário reduzido, sem cobrança).
- **Extensão operacional** é calculada somando o traçado do OSM entre estações em operação; difere poucos metros dos números oficiais (ex.: Linha 17 dá 6,8 km; o Metrô informa 6,7 km).
- **Trecho aproximado:** Maristela → Itaberaba-Hospital Vila Penteado (Linha 6, em obras) não tem trilho mapeado no OSM e é desenhado em reta (`aproximado: true`).
- **Cores no PDF do mapa:** o *Mapa do Transporte Metropolitano* usa CMYK de impressão, ligeiramente diferente do RGB do Guia; para tela vale o RGB do Guia.
- As relações do OSM da Linha 10 não têm Juventus-Mooca, Tamanduateí e Utinga; essas paradas são inseridas por `scripts/build-data.mjs` conforme o mapa oficial.
- **Diagrama esquemático** é gerado por algoritmo próprio (`scripts/build-schematic.mjs`): lupa radial no centro, direções arredondadas para múltiplos de 45°, ajuste por mínimos quadrados e cadeias octilineares entre estações-chave. Não copia o mapa oficial. Com a camada de trens ligada ainda há trechos encavalados perto da Barra Funda e de Osasco (a refinar).
- **Acessibilidade:** só 58 estações têm a marca no OSM. O site mostra ♿ apenas quando a marca é positiva; sem marca (ou "não", que pode estar desatualizado) aparece "sem informação confirmada". Por isso o planejador não exclui estações: a opção "Priorizar estações acessíveis" só dá preferência às confirmadas e lista as que não têm confirmação.
- **Situação das linhas** (`components/map/line-notes.ts`) descreve a situação conhecida em 20/10/2026. A Linha 17, antes "dias úteis, 9h–16h" (comunicado de 30/06/2026), passou a "segunda a sábado, 6h–22h" segundo a página de horários consultada em 20/10/2026.
- **Horários não verificados:** Motiva (4, 5, 8, 9), TIC Trens (7), CPTM (10) e Trivia (11, 12, 13) não têm horário em `horarios.json`: a página do Metrô remete às operadoras, a busca não achou página oficial atual (a da Motiva sobre a Linha 5 é de 2018) e o painel da CPTM carrega por script. O planejador marca essas linhas como "não verificado" — nunca como abertas ou fechadas.
- **Operação 24 h de sábado para domingo:** a página do Metrô não diz quais linhas nem estações; o projeto aplica às linhas operadas pela Companhia (1, 2, 3, 15) como "não verificado".
- **Avisos operacionais:** só o feed RSS do Metrô está ligado (`lib/ops/sources.ts`). Sem feed ou API pública: CPTM, Motiva, LinhaUni, TIC Trens, Trivia. Comunicados ficam 10 dias (operacionais) ou 3 dias (outros) e nunca são apresentados como situação em tempo real.
- **Por que não há cron de 10 minutos:** no plano Hobby a Vercel só aceita cron diário. A coleta é feita sob demanda com cache de 30 min no servidor (`use cache` + `cacheLife`), o que limita a leitura da fonte a no máximo 48 vezes por dia sem depender de agendamento. `/api/avisos/atualizar` (protegido por `CRON_SECRET`) força uma nova coleta.
