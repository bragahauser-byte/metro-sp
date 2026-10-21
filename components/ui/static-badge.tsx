import { FULL_SITE_URL, IS_STATIC } from "@/lib/env";

/** Selo da versão do GitHub Pages: deixa claro o que falta e onde está a versão completa. */
export function StaticBadge({ className = "" }: { className?: string }) {
  if (!IS_STATIC) return null;
  return (
    <p className={`bg-ink px-1.5 py-0.5 text-xs font-semibold text-bg ${className}`} style={{ borderRadius: 8 }}>
      Versão estática — versão completa em{" "}
      <a className="underline underline-offset-2" href={FULL_SITE_URL}>
        {FULL_SITE_URL.replace("https://", "")}
      </a>
    </p>
  );
}
