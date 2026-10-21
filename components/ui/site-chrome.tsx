import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { Icons } from "./button";

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
    <Link href="/" className="inline-flex min-h-control items-center gap-1" aria-label="Metrô, versão beta — início">
      <span className="text-xl font-bold">Metrô</span>
      <BetaTag />
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="flex min-h-8 items-center justify-between gap-1 px-2 sm:px-4">
      <Wordmark />
      <nav className="flex items-center gap-1 text-base font-medium sm:gap-2" aria-label="Principal">
        <Link href="/mapa" className="inline-flex min-h-control items-center underline-offset-4 hover:underline">
          Mapa
        </Link>
        <Link href="/linhas" className="inline-flex min-h-control items-center underline-offset-4 hover:underline">
          Linhas
        </Link>
        <Link href="/rota" aria-label="Como chegar" title="Como chegar" className="inline-flex size-control items-center justify-center sm:hidden">
          {Icons.search}
        </Link>
        <Link href="/rota" className="hidden min-h-control items-center underline-offset-4 hover:underline sm:inline-flex">
          Como chegar
        </Link>
        <Link href="/perto-de-mim" className="hidden min-h-control items-center underline-offset-4 hover:underline md:inline-flex">
          Perto de mim
        </Link>
        <Link href="/sobre" className="hidden min-h-control items-center underline-offset-4 hover:underline sm:inline-flex">
          Sobre
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
      . <Link className="underline underline-offset-2" href="/sobre">Sobre e fontes</Link> ·{" "}
      <Link className="underline underline-offset-2" href="/estilo">Estilo</Link> · Dados ©{" "}
      <a className="underline underline-offset-2" href="https://www.openstreetmap.org/copyright">
        OpenStreetMap contributors
      </a>
      .
    </footer>
  );
}
