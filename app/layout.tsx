import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Provisório: a família definitiva sai da Fase 1 (Helvetica Now é comercial e não entra no repo).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rede SP — mapa conceitual do metrô de São Paulo",
  description:
    "Projeto conceitual independente de design sobre a rede de metrô de São Paulo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <footer className="border-t border-foreground/10 px-4 py-6 text-xs text-foreground/70 sm:px-8">
          Projeto conceitual independente, sem vínculo com a Companhia do
          Metropolitano de São Paulo. Informações oficiais em{" "}
          <a
            className="underline underline-offset-2"
            href="https://www.metro.sp.gov.br"
          >
            metro.sp.gov.br
          </a>
          .
        </footer>
      </body>
    </html>
  );
}
