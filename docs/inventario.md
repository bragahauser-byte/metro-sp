# Inventário das referências (Fase 0)

Consultado em 20/10/2026. O material original fica em `_referencias/` (fora do git).

## 1. Paleta

### Cores de linha — fonte: Guia Rápido da Identidade Visual do Metrô, REV.2 (nov/2022), p. 26

Atenção: na tabela do guia, os cabeçalhos "Sistema RGB" e "Sistema CMYK" estão trocados. Os valores abaixo usam a coluna que de fato é RGB (0–255).

| Token | Linha | Pantone | RGB | Hex |
|---|---|---|---|---|
| `--line-1` | 1-Azul | 300 C | 0 99 186 | `#0063BA` |
| `--line-2` | 2-Verde | 341 C | 9 122 94 | `#097A5E` |
| `--line-3` | 3-Vermelha | Red 032 C | 240 33 55 | `#F02137` |
| `--line-4` | 4-Amarela | 123 C | 252 201 23 | `#FCC917` |
| `--line-5` | 5-Lilás | 2665 C | 135 77 191 | `#874DBF` |
| `--line-6` | 6-Laranja | 151 C | 255 131 0 | `#FF8300` |
| `--line-15` | 15-Prata | 877 C | 141 143 140 | `#8D8F8C` |
| `--line-17` | 17-Ouro | 138 C | 213 132 5 | `#D58405` |
| `--line-7` | 7-Rubi | 220 C | 171 4 80 | `#AB0450` |
| `--line-8` | 8-Diamante | 415 C | 165 165 150 | `#A5A596` |
| `--line-9` | 9-Esmeralda | Green C | 100 179 150 | `#64B396` |
| `--line-10` | 10-Turquesa | 3145 C | 0 118 135 | `#007687` |
| `--line-11` | 11-Coral | 1665 C | 245 95 26 | `#F55F1A` |
| `--line-12` | 12-Safira | 2747 C | 38 38 112 | `#262670` |
| `--line-13` | 13-Jade | 354 C | 0 176 82 | `#00B052` |

Também constam no guia (planejadas/serviços, para uso futuro): 18-Bronze `#7F614D`, Airport Express `#008349`, Airport Connect `#A8CF45`, 19-Celeste `#05A4E1`, 20-Rosa `#EA2775`, 21-Grafite `#636266`, 22-Bordô `#783245`, 23-Limão `#61BF1A`.

Contraste (WCAG, número do badge sobre a cor): passam AA com branco (≥ 4,5) as linhas 1, 2, 5, 7, 10 e 12. A 3-Vermelha dá 4,22 com branco (passa só como texto grande/bold ≥ 3) e 4,98 com preto. As linhas 4, 6, 8, 9, 11, 13, 15 e 17 precisam de número em preto (6,4 a 13,5), como o MTA faz com N/Q/R/W. A decidir na Fase 1.

### Neutros

| Cor | Valor | Origem |
|---|---|---|
| Azul Metrô (institucional) | `#001489` (Reflex Blue C) | Guia Rápido p. 22 — é cor da marca; usar só como citação, não como identidade do site |
| Branco / Preto | `#FFFFFF` / `#000000` | Guia Rápido p. 24 (Paleta de Apoio) |
| Prata / Cinza | ≈ `#D0D0D0`, ≈ `#878787` | Guia Rápido p. 24 — amostrados da imagem, o guia não dá o valor |
| Fundo de mapa claro | ≈ `#F5F5F5`, ruas ≈ `#DDE3E6`, parques ≈ `#E3F0DF` | Amostrados do moodboard (MTA) — referência de mood, não de marca |
| Fundo de mapa escuro | ≈ `#000000`, ruas ≈ `#1F1F1F` | Idem |

## 2. Tipografia

| Família | Arquivos | Licença | Pode ir para a web? |
|---|---|---|---|
| Helvetica Now Display (20 estilos) | `.ttf/.woff/.woff2/.eot` | Comercial (Monotype); nenhum arquivo de licença na pasta | Não — fica só em `_referencias/` |
| Helvetica Now Text (4 estilos "demo") | `-demo` | Demo: uso de avaliação, não de produção | Não |
| Helvetica (institucional) / Frutiger (sinalização) | citadas no Guia p. 20 | Comerciais | Não |

Alternativas livres (licença OFL/GUST, permitem web), a comparar visualmente na Fase 1:

1. **Inter** (OFL) com corte Display — mais próxima do desenho "Now", ótima em UI e telas pequenas. Recomendação.
2. **TeX Gyre Heros** (GUST Font License) — clone métrico da Helvetica clássica; mais fiel ao "Helvetica dos anos 70", menos refinada em tela.
3. **Hanken Grotesk** ou **Schibsted Grotesk** (OFL) — grotescas neutras, alternativa se quisermos menos "cara de Inter".

## 3. Princípios visuais do moodboard

O moodboard é o **Live Subway Map da MTA (Work & Co, 2020)**: telas mobile/desktop, claro/escuro, zoom de detalhe.

1. **O mapa é a interface.** Tela cheia, sem cabeçalho; tudo o mais flutua sobre ele (cartão no canto superior esquerdo no desktop, bottom sheet no mobile, botões redondos no canto inferior direito).
2. **Cor = informação, só nas linhas.** Basemap quase monocromático (cinza claríssimo / preto), ruas finas, verde pálido de parque; a única saturação da tela é das linhas e dos badges.
3. **Zoom semântico.** De longe, linhas finas de 2 px; de perto, as linhas viram faixas largas paralelas (uma por serviço, com fio branco entre elas), curvas de raio constante e estações como pontos pretos com o rótulo do serviço embaixo.
4. **Badges circulares como sistema de navegação.** Grade de círculos coloridos com número/letra em branco (ou preto nas cores claras); clicar filtra a linha. Estado alterado aparece no próprio badge ("!").
5. **Tipografia grotesca bold, hierarquia por peso e tamanho.** Nome da estação em bold preto; ruas em serifa cinza minúscula (camada de fundo); nada de caixas ou ícones decorativos.
6. **Transferências como fios pretos finos** ligando os pontos das estações — o diagrama mostra a conexão sem desenhar "estações-anel".
7. **Mesmo layout claro e escuro**, só invertendo fundo e basemap; as cores de linha não mudam.
8. **Cartões brancos com sombra mínima e cantos levemente arredondados**; abas sublinhadas (Now / Tonight / Weekend) como única navegação secundária.

Da tradição paulista (Guia Rápido): grid construtivo com módulos quadrados, diagonais a 45° (o próprio símbolo é dois quadrados deslocados na diagonal), Helvetica bold/roman, e o fio divisor como elemento gráfico.

## 4. O que do Guia Rápido vira conteúdo do site

- **Cores das linhas (p. 26)** → tokens `--line-*` e badges.
- **História do desenho (p. 7):** símbolo de 1967 por João Carlos Cauduro e Ludovico Martino, com a "defesa do desenho" (citação Deconsult/Hochtief/Montreal, 1968/69) → texto na página `/sobre`, com crédito.
- **Famílias tipográficas (p. 20):** Helvetica institucional + Frutiger na sinalização → parágrafo em `/sobre` explicando a escolha da alternativa livre.
- **Identificadores alusivos (p. 27):** mapa de linhas, totem de estação, Frota A, logo sonoro (4 notas de "O Trenzinho do Caipira", Villa-Lobos) → curiosidades com fonte.
- **Não vira conteúdo:** símbolo, assinaturas, pattern e o Azul Metrô como identidade — o próprio guia diz que a marca é registrada e de uso exclusivo da Companhia (p. 2 e 28). O site cita, não usa.

## 5. Bônus: Mapa do Transporte Metropolitano (julho/2026)

`_referencias/mapa-da-rede.pdf` confirma o estado da rede para a Fase 2 (ainda a conferir no site oficial):

- Operadores: Metrô (1, 2, 3, 15, 17), Motiva (4, 5, 8, 9), Linha Uni (6), TIC Trens (7), CPTM (10), Trivia (11, 12, 13 e Expresso Aeroporto).
- Linha 17-Ouro: Morumbi – Washington Luís, com Aeroporto de Congonhas.
- Linha 6-Laranja: trecho norte já desenhado (João Paulo I/Freguesia do Ó – Perdizes).
