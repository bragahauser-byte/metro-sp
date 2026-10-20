# Fontes

Toda informação factual do site precisa de uma linha aqui, com data de consulta.

## Arquivos e como são gerados

| Arquivo | Conteúdo | Gerado por |
|---|---|---|
| `line-colors.json` | Cor e tinta (número) de cada linha | à mão, a partir do Guia Rápido |
| `lines.json` | Linhas: nome, cor, operador, tipo, status, extensão operacional, sequências de estações | `npm run data:build` |
| `stations.geojson` | Estações: nome, complemento, linhas, status (geral e por linha), parada de cada linha | `npm run data:build` |
| `edges.json` | Grafo: trechos estação→estação por linha (distância em m) e transferências | `npm run data:build` |
| `tracks.geojson` | Geometria real de cada trecho (traçado dos trilhos) | `npm run data:build` |

Atualizar: `npm run data:fetch` (baixa do OSM para `data/raw/`, fora do git) → `npm run data:build` → `npm run validate`.

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

## Observações

- **Status `operacao-assistida`** cobre também a "operação transitória" da Linha 17 (horário reduzido, sem cobrança).
- **Extensão operacional** é calculada somando o traçado do OSM entre estações em operação; difere poucos metros dos números oficiais (ex.: Linha 17 dá 6,8 km; o Metrô informa 6,7 km).
- **Trecho aproximado:** Maristela → Itaberaba-Hospital Vila Penteado (Linha 6, em obras) não tem trilho mapeado no OSM e é desenhado em reta (`aproximado: true`).
- **Cores no PDF do mapa:** o *Mapa do Transporte Metropolitano* usa CMYK de impressão, ligeiramente diferente do RGB do Guia; para tela vale o RGB do Guia.
- As relações do OSM da Linha 10 não têm Juventus-Mooca, Tamanduateí e Utinga; essas paradas são inseridas por `scripts/build-data.mjs` conforme o mapa oficial.
