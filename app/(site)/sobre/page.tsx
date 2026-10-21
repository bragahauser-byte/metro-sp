import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sobre",
  description: "Sobre o projeto conceitual: o que é, fontes dos dados, créditos e atribuições.",
};

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2 border-t border-rule-strong pt-3 md:grid-cols-[1fr_2fr]">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="flex max-w-[64ch] flex-col gap-2 text-base">{children}</div>
    </section>
  );
}

export default function SobrePage() {
  return (
    <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-2 py-6 sm:px-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Sobre</h1>
        <p className="max-w-[60ch] text-lg text-ink-muted">
          Um estudo de design que trata a rede sobre trilhos de São Paulo como objeto de interface: um mapa vivo, entre o
          diagrama e a geografia.
        </p>
      </header>

      <Block title="O que é">
        <p>
          Projeto conceitual independente, feito como portfólio de design. <strong>Não é o site oficial</strong> e não tem
          vínculo com a Companhia do Metropolitano de São Paulo nem com as concessionárias. Informações oficiais em{" "}
          <a className="underline" href="https://www.metro.sp.gov.br">
            metro.sp.gov.br
          </a>
          .
        </p>
        <p>
          A interface estuda o Live Subway Map, de Nova York (Work & Co para a MTA, 2020), que junta a clareza do diagrama de
          Massimo Vignelli com a orientação geográfica do mapa de Michael Hertz: o zoom muda o que aparece, e não só o
          tamanho.
        </p>
      </Block>

      <Block title="Identidade">
        <p>
          As cores das linhas seguem o Guia Rápido da Identidade Visual do Metrô de São Paulo (REV.2, 2022). O símbolo do
          Metrô — dois quadrados deslocados na diagonal — foi apresentado em 1967 pelos arquitetos João Carlos Cauduro e
          Ludovico Martino; ele é marca registrada da Companhia e por isso não é usado aqui. O nome do site aparece só em
          texto.
        </p>
        <p>
          A tipografia institucional do Metrô é a Helvetica (e a Frutiger na sinalização). Como são fontes comerciais, este
          site usa a Inter, de licença livre, com desenho próximo.
        </p>
      </Block>

      <Block title="Dados">
        <p>
          Estações, ordem das linhas, operadores e integrações conferidos com o Mapa do Transporte Metropolitano (Governo do
          Estado de São Paulo, julho de 2026). Situação das Linhas 6 e 17 em notícias oficiais de junho a agosto de 2026.
          Lista completa, com datas de consulta, em{" "}
          <a className="underline" href="https://github.com/bragahauser-byte/metro-sp/blob/main/data/sources.md">
            data/sources.md
          </a>
          .
        </p>
        <p>
          Traçado dos trilhos, posição das paradas, entradas e marcas de acessibilidade:{" "}
          <a className="underline" href="https://www.openstreetmap.org/copyright">
            © OpenStreetMap contributors
          </a>
          , sob a licença ODbL. Mapa de fundo:{" "}
          <a className="underline" href="https://openfreemap.org">
            OpenFreeMap
          </a>{" "}
          e{" "}
          <a className="underline" href="https://www.openmaptiles.org">
            © OpenMapTiles
          </a>
          .
        </p>
        <p>
          O diagrama esquemático é gerado por um algoritmo próprio a partir da geografia.
        </p>
      </Block>

      <Block title="Horários e rotas">
        <p>
          O planejador estima o tempo pelo traçado (velocidade média, 30 s por parada, 5 min por baldeação) e oferece até três
          alternativas. Com data e hora, cada embarque e cada baldeação são conferidos contra os horários publicados pelo Metrô
          (
          <a className="underline" href="https://www.metro.sp.gov.br/sua-viagem/horarios/">
            metro.sp.gov.br/sua-viagem/horarios
          </a>
          , consulta em 20/10/2026) — fechamento de cada estação, baldeações só até 0h00, integrações com horário próprio — e,
          para a Linha 6, pelo comunicado da Prefeitura de 02/07/2026.
        </p>
        <p>
          Linhas de outras operadoras (Motiva, TIC Trens, CPTM, Trivia) aparecem como <strong>horário não verificado</strong>:
          não estendemos as regras do Metrô para elas. “Impossível” só aparece quando a fonte oficial confirma.
        </p>
      </Block>

      <Block title="Avisos">
        <p>
          Comunicados oficiais vêm do feed RSS público do site do Metrô, lido no máximo a cada 30 minutos e guardado em
          cache — não há raspagem de páginas. São comunicados, com data e link, e não situação em tempo real. As linhas fora da
          operação normal (6 e 17) são descritas com fonte e data.
        </p>
      </Block>

      <Block title="Acessibilidade e voz">
        <p>
          Preferências no ícone de ajustes: tema Claro, Escuro ou Sistema (nunca muda sozinho pelo horário), texto maior, mais
          contraste e reduzir movimento. Tudo fica só no seu navegador.
        </p>
        <p>
          Você pode dizer a rota (“da estação São Lucas até a estação Tatuapé”) e ouvir as instruções. O reconhecimento usa o
          serviço de voz do próprio navegador, que pode processar o áudio fora do aparelho; este site não recebe nem guarda o
          áudio. Sem suporte a voz, tudo funciona digitando.
        </p>
      </Block>

      <Block title="Privacidade">
        <p>
          A localização só é pedida quando você toca em “Estação mais perto de mim”. Ela é usada no próprio navegador para
          calcular distâncias e não é enviada, salva nem registrada — nem vai para o endereço da página.
        </p>
      </Block>

      <Block title="Créditos">
        <p>
          Design e desenvolvimento: Malu (
          <a className="underline" href="https://github.com/bragahauser-byte">
            github.com/bragahauser-byte
          </a>
          ). Código aberto em{" "}
          <a className="underline" href="https://github.com/bragahauser-byte/metro-sp">
            github.com/bragahauser-byte/metro-sp
          </a>
          . Sistema visual em{" "}
          <Link className="underline" href="/estilo">
            /estilo
          </Link>
          .
        </p>
      </Block>
    </main>
  );
}
