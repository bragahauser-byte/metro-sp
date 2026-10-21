export type Status = "operando" | "operacao-assistida" | "em-obras" | "planejada";

const LABELS: Record<Status, string> = {
  operando: "Operando",
  "operacao-assistida": "Operação assistida",
  "em-obras": "Em obras",
  planejada: "Planejada",
};

/** Status sem cor: a forma do marcador carrega a informação, o texto sempre acompanha. */
function Marker({ status }: { status: Status }) {
  const common = "size-1.5 shrink-0";
  switch (status) {
    case "operando":
      return (
        <svg viewBox="0 0 12 12" className={common} aria-hidden>
          <circle cx="6" cy="6" r="5" fill="currentColor" />
        </svg>
      );
    case "operacao-assistida":
      return (
        <svg viewBox="0 0 12 12" className={common} aria-hidden>
          <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6 1.5a4.5 4.5 0 0 1 0 9z" fill="currentColor" />
        </svg>
      );
    case "em-obras":
      return (
        <svg viewBox="0 0 12 12" className={common} aria-hidden>
          <rect x="1" y="1" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M1 7l6-6M5 11l6-6M1 11L11 1" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case "planejada":
      return (
        <svg viewBox="0 0 12 12" className={common} aria-hidden>
          <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
        </svg>
      );
  }
}

export function StatusChip({ status }: { status: Status }) {
  return (
    <span
      className="inline-flex items-center gap-1 border border-rule px-1 py-0.5 text-xs font-medium text-ink"
      style={{ borderRadius: "var(--radius-control)" }}
    >
      <Marker status={status} />
      {LABELS[status]}
    </span>
  );
}
