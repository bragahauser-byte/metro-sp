import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function BetaTag() {
  return (
    <span
      className="inline-flex items-center bg-ink px-0.5 py-px text-[0.625rem] font-bold uppercase tracking-wider text-bg"
      style={{ borderRadius: "var(--radius-control)" }}
    >
      Beta
    </span>
  );
}

/** Nome do site em texto — nunca o logotipo oficial. */
export function Wordmark() {
  return (
    <Link href="/" className="inline-flex items-center gap-1" aria-label="Metrô, versão beta — início">
      <span className="text-title-s font-bold tracking-tight">Metrô</span>
      <BetaTag />
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="flex h-8 items-center justify-between px-2 sm:px-4">
      <Wordmark />
      <nav className="flex items-center gap-2 text-body font-medium" aria-label="Principal">
        <Link href="/mapa" className="underline-offset-4 hover:underline">
          Mapa
        </Link>
        <Link href="/linhas" className="underline-offset-4 hover:underline">
          Linhas
        </Link>
        <Link href="/perto-de-mim" className="hidden underline-offset-4 hover:underline sm:inline">
          Perto de mim
        </Link>
        <Link href="/sobre" className="hidden underline-offset-4 hover:underline sm:inline">
          Sobre
        </Link>
        <ThemeToggle />
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-rule px-2 py-3 text-caption text-ink-muted sm:px-4">
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
