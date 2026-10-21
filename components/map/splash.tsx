import { BetaTag } from "@/components/ui/site-chrome";
import { MetroLogo } from "@/components/ui/metro-logo";

/**
 * Abertura mínima: marca + indicador discreto, só enquanto o mapa e os dados carregam (sem atraso
 * artificial). Sai com um fade curto que vai a zero com "reduzir movimento" (tokens de duração).
 */
export function Splash({ leaving = false }: { leaving?: boolean }) {
  return (
    <div
      aria-hidden={leaving}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-bg transition-opacity duration-(--duration-slow) ease-standard ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <p className="flex items-center gap-1" role="status" aria-label="Carregando o mapa">
        <MetroLogo className="h-7 w-auto" title="Metrô" />
        <BetaTag />
      </p>
      <span aria-hidden className="splash-bar relative h-0.5 w-8 overflow-hidden rounded-full bg-rule" />
    </div>
  );
}
