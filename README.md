# Metrô (beta)

Site conceitual de design sobre a rede sobre trilhos de São Paulo. Abre direto no mapa, como o Google Maps e o Apple Maps: traçado real por padrão (o esquemático continua como opção), busca por estação, endereço, rua, CEP ou lugar, rota de porta a porta com os trechos a pé, horários oficiais quando existem, acessibilidade e voz.

**No ar:**

- Versão completa (Vercel): https://metro-sp-beta.vercel.app
- Versão estática (GitHub Pages): https://bragahauser-byte.github.io/metro-sp/

Projeto conceitual independente, sem vínculo com a Companhia do Metropolitano de São Paulo. Informações oficiais em [metro.sp.gov.br](https://www.metro.sp.gov.br).

## O que tem

- **Mapa em tela cheia** com abertura curta (só enquanto carrega). Painel flutuante compacto: modo do mapa (Real / Esquemático), linhas, interruptor dos trens metropolitanos (7 a 13) e o botão de busca. No celular, folha com três estados (recolhida, meio, expandida), arrastável; Esc e o botão voltar fecham e o foco volta para quem abriu.
- **Localização ao abrir (v1.5):** aviso curto e o pedido do navegador logo depois. Permitida: o mapa centra em você (ponto azul) e "Sua localização" vira a origem padrão. Negada ou com erro: tudo continua funcionando; a origem vem da busca e "Usar minha localização" explica como liberar. `watchPosition` só enquanto a rota está aberta. Nada vai para o servidor nem fica salvo.
- **Busca por qualquer lugar:** estações (na hora, sem rede) e lugares/endereços — endereço com número, CEP (com ou sem traço), bairro, nome de lugar (“MASP”, “Allianz Parque” → Nubank Parque). Ordem: o que bate com o texto primeiro, depois o mais perto. Carregando, "nada encontrado" com sugestões e erro claro; nunca trava.
- **Rota de porta a porta:** para cada ponta que é um lugar, as 3 estações mais próximas (2 km, ampliando para 3,5 e 5 km); escolhe a combinação de menor tempo total (a pé + rede + a pé). Caminhada sempre rotulada como estimativa (linha reta × 1,3 a 4,5 km/h). No mapa: marcadores de origem e destino e o trecho a pé tracejado. Mais de 3 km da rede: aviso com a estação mais próxima e o botão para usá-la; mais de 5 km: sem rota a pé, mas com a estação mais próxima.
- **Passo a passo:** "Caminhe 450 m (6 min) até a Estação Paraíso" → "Pegue a Linha 2-Verde sentido Vila Prudente" → "Baldeie para a Linha 1-Azul sentido Jabaquara" → "Desça em Saúde" → "Caminhe 300 m até o destino", cada passo com a cor e o número da linha, o sentido, as paradas, o tempo e a situação agora da linha (alteração em destaque; "sem leitura automática" quando não há fonte). Tocar num passo leva o mapa até ele.
- **Horários:** só de fonte oficial consultada (Metrô; Motiva para 4, 5, 8 e 9). Sem fonte = "horário não verificado", nunca tratado como aberto.
- **Celular como o Live Subway Map:** símbolo (abre os ajustes) e nome no alto; embaixo, botão de linhas, pílula **Agora** e avisos; à direita, busca e localização. A busca abre como no Apple Maps: campo + fechar, **Recentes** (só neste navegador) e **Buscar por perto** (shoppings, farmácias, restaurantes num raio de 2 km do centro do mapa).
- **Agora (situação das linhas, a cada 15 min):** Linhas 10–13 pelo mesmo endpoint público que o site da CPTM usa; Linhas 4–9 pela API da ARTESP quando `ARTESP_API_KEY` estiver configurada; Linhas 1, 2, 3, 15 e 17 sem leitura automática (o Metrô não publica a situação em formato aberto) — o site mostra o link do canal oficial em vez de supor "normal". Links para TemTrem, ARTESP, Metrô e CPTM (site e X) e concessionárias.
- **Avisos:** comunicados do feed RSS do Metrô, conferidos a cada 15 min, com última atualização bem-sucedida separada da data de cada comunicado.
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
| `CRON_SECRET` | Vercel (Settings → Environment Variables) | Libera `GET /api/avisos/atualizar` com `Authorization: Bearer <segredo>` (força nova coleta de avisos). Sem ela o endpoint responde 503; os avisos continuam se atualizando sozinhos a cada 15 min. |
| `ARTESP_API_KEY` | Vercel (Settings → Environment Variables) | Liga a situação das Linhas 4 a 9 (API do CCM da ARTESP). A chave é pessoal: peça em https://ccm.artesp.sp.gov.br → Minha Conta → Minhas APIs. Endpoint "Status em Tempo Real" (`/metroferroviario/api/status/`), cabeçalho `Authorization: Api-Key <chave>`. Limite de 12 req/h — o site lê no máximo 4 por hora (uma vez a cada 15 min por instância). Usada só na função da Vercel, nunca no navegador nem no build do Pages. Sem ela, ou com 401/403/429/tempo esgotado, as linhas 4–9 aparecem como "sem leitura automática" com link da ARTESP. Se a ARTESP responder 403, a chave tem lista de IPs: a Vercel não tem IP fixo, então deixe a lista vazia no portal. |
| `DEPLOY_TARGET=pages` | só no build | Usado por `npm run build:pages`; não configure na Vercel. |

## Geocodificação

Provedores: **[Photon](https://photon.komoot.io)** (komoot) na digitação e **[Nominatim](https://nominatim.org)** de reforço, os dois do OpenStreetMap e sem chave. A política do Nominatim (https://operations.osmfoundation.org/policies/nominatim/) proíbe autocomplete no navegador e pede no máximo 1 req/s, identificação e cache: por isso ele só é chamado **no servidor**, quando o Photon não acha nada que bata com o texto, numa fila de 1 req/s, com User-Agent/Referer e cache de 1 dia. No Pages (sem servidor) só o Photon.

- Vercel: `/api/geocode` faz proxy com cache (CDN 1 dia, memória 1 h), limite por IP (30/min) e teto global (120/min), User-Agent identificável.
- Pages: o navegador chama o Photon direto (CORS liberado), com mínimo de 3 letras, espera de 300 ms e cancelamento das buscas antigas.
- Apelidos (MASP, Allianz Parque) e CEP sem traço são tratados antes da consulta. Resultados ordenados por: nome igual → começa com o texto → todas as palavras → distância (do GPS, calculada só no aparelho, ou do centro do mapa).
- Só o texto digitado (e, sem GPS, o centro do mapa arredondado) é enviado; a localização do GPS nunca. Atribuição "Photon · © OpenStreetMap contributors" aparece nos resultados.

## Vercel × GitHub Pages

| | Vercel | GitHub Pages |
|---|---|---|
| Mapa, linhas, estações, rotas entre estações, horários | sim | sim |
| Busca de endereços e lugares | via `/api/geocode` (cache + limite) | direto no Photon |
| Avisos e situação das linhas (Agora) | sim (`/api/avisos`, a cada 15 min) | não — mostra "disponível na versão completa" e os links dos canais |
| Buscar por perto | via `/api/geocode?perto=` | direto no Photon (`/reverse`) |
| Atualização forçada de avisos | `/api/avisos/atualizar` com `CRON_SECRET` | não |
| Endereços antigos | redirecionamento 308 no servidor | redirecionamento no navegador |
| Imagem de compartilhamento (OG) | sim | não |

A versão do Pages mostra o selo "Versão estática — versão completa em metro-sp-beta.vercel.app". Publicação: workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) (testes, lint, tipos e build; se algo falhar, nada é publicado).

Stack: Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind CSS 4 + MapLibre GL. Regras do projeto em [`CLAUDE.md`](CLAUDE.md).
