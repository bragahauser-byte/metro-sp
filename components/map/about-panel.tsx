import Link from "next/link";
import type { ReactNode } from "react";
import { BackButton } from "./panels";

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1 border-t border-rule pt-2">
      <h3 className="text-base font-bold">{title}</h3>
      <div className="flex flex-col gap-1 text-sm">{children}</div>
    </section>
  );
}

/** Sobre, fontes e créditos — aberto pelo botão de ajustes (antes era a página /sobre). */
export function AboutPanel({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <BackButton onClick={onBack} />
        <h2 className="text-lg font-bold">Sobre</h2>
      </div>
      <p className="text-base text-ink-muted">
        Um estudo de design que trata a rede sobre trilhos de São Paulo como objeto de interface: um mapa vivo, entre o diagrama e a
        geografia.
      </p>
      <Block title="O que é">
        <p>
          Projeto conceitual independente, feito como portfólio de design. <strong>Não é o site oficial</strong> e não tem vínculo com a
          Companhia do Metropolitano de São Paulo nem com as concessionárias. Informações oficiais em{" "}
          <a className="underline" href="https://www.metro.sp.gov.br">
            metro.sp.gov.br
          </a>
          .
        </p>
        <p>
          A interface estuda o Live Subway Map de Nova York (Work &amp; Co para a MTA, 2020). As cores das linhas seguem o Guia Rápido
          da Identidade Visual do Metrô (REV.2, 2022); o símbolo do Metrô (Cauduro/Martino, 1967) é marca registrada e não é usado.
          Tipografia: Inter (licença livre).
        </p>
      </Block>
      <Block title="Dados e mapa">
        <p>
          Estações, operadores e integrações conferidos com o Mapa do Transporte Metropolitano (Governo de SP, jul/2026). Traçado,
          paradas, entradas e acessibilidade:{" "}
          <a className="underline" href="https://www.openstreetmap.org/copyright">
            © OpenStreetMap contributors
          </a>{" "}
          (ODbL). Mapa de fundo:{" "}
          <a className="underline" href="https://openfreemap.org">
            OpenFreeMap
          </a>{" "}
          e{" "}
          <a className="underline" href="https://www.openmaptiles.org">
            © OpenMapTiles
          </a>
          . Lista completa com datas em{" "}
          <a className="underline" href="https://github.com/bragahauser-byte/metro-sp/blob/main/data/sources.md">
            data/sources.md
          </a>
          .
        </p>
      </Block>
      <Block title="Busca de endereços e lugares">
        <p>
          Endereços, ruas, CEPs e lugares vêm do{" "}
          <a className="underline" href="https://photon.komoot.io">
            Photon
          </a>{" "}
          (komoot), com dados © OpenStreetMap, restrito à Grande São Paulo. Só o texto digitado é enviado — nunca sua localização. O
          trecho a pé até a estação é uma <strong>estimativa</strong>: linha reta × 1,3 a 4,5 km/h, não um caminho pelas ruas.
        </p>
      </Block>
      <Block title="Horários e rotas">
        <p>
          O tempo na rede é estimado pelo traçado (velocidade média, 30 s por parada, 5 min por baldeação). Com data e hora, embarques e
          baldeações são conferidos contra os horários oficiais publicados. Linhas sem horário confirmado em fonte oficial aparecem
          como <strong>horário não verificado</strong> — nunca como abertas ou fechadas.
        </p>
      </Block>
      <Block title="Avisos">
        <p>
          A cada 15 minutos: situação das Linhas 10 a 13 pela CPTM e das 4 a 9 pela ARTESP (quando a chave da API está
          configurada), e comunicados do feed RSS do Metrô. O Metrô não publica a situação das Linhas 1, 2, 3, 15 e 17 em formato
          aberto — para elas o site mostra o link do canal oficial. O TemTrem aparece só como link: os termos dele não permitem
          leitura automática.
        </p>
      </Block>
      <Block title="Acessibilidade, voz e privacidade">
        <p>
          Tema, texto maior, mais contraste e reduzir movimento ficam no ícone de ajustes, salvos só neste navegador. Você pode dizer a
          rota (“de Rua Otávio Alves Dundas até Shopping Eldorado”) e ouvir as instruções; o reconhecimento usa o serviço de voz do
          próprio navegador. A localização só é pedida quando você toca no botão e fica no aparelho.
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
    </div>
  );
}
