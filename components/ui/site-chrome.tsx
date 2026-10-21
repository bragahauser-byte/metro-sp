import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function BetaTag() {
  return (
    <span
      className="inline-flex items-center bg-ink px-0.5 py-px text-xs font-bold uppercase text-bg"
      style={{ borderRadius: "var(--radius-control)" }}
    >
      Beta
    </span>
  );
}

/** Nome do site em texto — nunca o logotipo oficial. */
export function Wordmark() {
  return (
    <Link href="/" className="inline-flex min-h-control items-center gap-1" aria-label="Metrô, versão beta — abrir o mapa">
      <span className="text-xl font-bold">Metrô</span>
      <BetaTag />
    </Link>
  );
}

/** Cabeçalho das páginas fora do mapa (só /estilo): voltar ao mapa e ajustes. Sem menu. */
export function SiteHeader() {
  return (
    <header className="flex min-h-8 items-center justify-between gap-1 px-2 sm:px-4">
      <Wordmark />
      <nav className="flex items-center gap-1 text-base font-medium" aria-label="Principal">
        <Link href="/" className="inline-flex min-h-control items-center underline-offset-4 hover:underline">
          Voltar ao mapa
        </Link>
        <ThemeToggle />
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-rule px-2 py-3 text-xs text-ink-muted sm:px-4">
      Projeto conceitual independente, sem vínculo com a Companhia do Metropolitano de São
      Paulo. Informações oficiais em{" "}
      <a className="underline underline-offset-2" href="https://www.metro.sp.gov.br">
        metro.sp.gov.br
      </a>
      . <Link className="underline underline-offset-2" href="/?painel=sobre">Sobre e fontes</Link> ·{" "}
      <Link className="underline underline-offset-2" href="/estilo">Estilo</Link> · Dados ©{" "}
      <a className="underline underline-offset-2" href="https://www.openstreetmap.org/copyright">
        OpenStreetMap contributors
      </a>
      .
    </footer>
  );
}
