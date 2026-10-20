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
/app            rotas (/, /mapa, /linhas/[id], /estacoes/[slug], /perto-de-mim, /sobre)
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
- Tipografia: **Inter** (OFL) via `next/font`. Helvetica Now (em `_referencias/tipografia projeto`) é comercial — NÃO commitar.
- Mobile-first. Testar em 360px, 768px, 1280px e 1920px.
- Acessibilidade WCAG AA: contraste, foco visível, navegação por teclado, e toda informação do mapa também disponível em lista (o mapa nunca é o único caminho).
- Dark mode e light mode.

## Regras de dados

- Toda informação factual (estações, linhas, status de operação, integrações) precisa de fonte registrada em `/data/sources.md` com data de consulta.
- A rede muda: em 2026 entraram a Linha 17-Ouro (monotrilho, operação provisória) e o primeiro trecho da Linha 6-Laranja (6 estações, operação assistida). Modele status por linha e por estação: `operando | operacao-assistida | em-obras | planejada`.
- Dados do OpenStreetMap exigem atribuição ODbL ("© OpenStreetMap contributors") no mapa e na página Sobre.
- Não fazer scraping de endpoints oficiais sem verificar termos de uso; status em tempo real só com fonte que permita.

## Geolocalização

- Pedir permissão só por ação do usuário (botão "Estação mais perto de mim"), nunca no carregamento.
- Localização é processada só no navegador; nunca enviar a servidor, salvar ou logar.
- Tratar negação/erro/timeout com mensagem clara e alternativa (buscar estação por nome).

## Fluxo de trabalho Git + Vercel (obrigatório)

Trabalhe em passos pequenos. Ao final de cada passo concluído:

1. `npm run lint` e `npx tsc --noEmit` e `npm run build` — só siga se tudo passar.
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
