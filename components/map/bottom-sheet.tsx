"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type Ref } from "react";
import { Card } from "@/components/ui/card";

export type Snap = "recolhido" | "meio" | "expandido";
const ORDER: Snap[] = ["recolhido", "meio", "expandido"];

/** Arrasto maior que isto (ou mais rápido que FLICK_VELOCITY) muda de estado. */
const SNAP_DISTANCE = 48;
const FLICK_VELOCITY = 0.5; // px/ms

/**
 * Folha do celular, como no Google Maps e no Apple Maps: sempre presente, com três estados —
 * recolhido (só a parte de cima), meio e expandido. Arrasta-se pela alça ou pelo cabeçalho (não
 * briga com a rolagem do conteúdo nem com o mapa); toque na alça alterna; arrasto curto volta.
 * Esc e o botão voltar do aparelho são tratados por quem usa a folha (map-app).
 */
export function BottomSheet({
  title,
  snap,
  onSnap,
  peek,
  children,
  headingRef,
  onEscape,
}: {
  title: string;
  snap: Snap;
  onSnap: (s: Snap) => void;
  /** Sempre visível, logo abaixo da alça (ex.: botão de busca e modo do mapa). */
  peek?: ReactNode;
  children: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
  onEscape: () => void;
}) {
  const [dragY, setDragY] = useState<number | null>(null);
  const drag = useRef<{ startY: number; lastY: number; lastT: number; v: number; id: number } | null>(null);
  const idx = ORDER.indexOf(snap);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button:not([data-alca]), a, input") || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, lastY: e.clientY, lastT: e.timeStamp, v: 0, id: e.pointerId };
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.v = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    const dy = e.clientY - d.startY;
    // Nos extremos resiste (efeito elástico); no meio acompanha o dedo.
    const atEdge = (dy < 0 && idx === ORDER.length - 1) || (dy > 0 && idx === 0);
    setDragY(atEdge ? dy * 0.3 : dy);
  }
  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const dy = e.clientY - d.startY;
    setDragY(null);
    if (Math.abs(dy) < 6) return; // foi um toque, não um arrasto
    if (dy < -SNAP_DISTANCE || d.v < -FLICK_VELOCITY) {
      // Arrasto longo para cima vai direto ao expandido.
      onSnap(ORDER[Math.min(ORDER.length - 1, idx + (dy < -240 ? 2 : 1))]);
    } else if (dy > SNAP_DISTANCE || d.v > FLICK_VELOCITY) {
      onSnap(ORDER[Math.max(0, idx - (dy > 240 ? 2 : 1))]);
    }
  }

  const animated = dragY === null;
  const maxH = snap === "expandido" ? "calc(100dvh - 88px)" : snap === "meio" ? "48dvh" : undefined;

  return (
    <section
      id="folha-do-mapa"
      aria-labelledby="folha-titulo"
      className="pointer-events-auto md:hidden"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onEscape();
        }
      }}
    >
      <Card
        className={`anim-sheet mx-1 flex min-h-0 flex-col ${animated ? "sheet-snap" : ""}`}
        style={{
          borderRadius: "var(--radius-sheet) var(--radius-sheet) var(--radius-card) var(--radius-card)",
          transform: `translateY(${dragY ?? 0}px)`,
        }}
      >
        <div
          className="cursor-grab touch-none select-none active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            drag.current = null;
            setDragY(null);
          }}
        >
          <button
            type="button"
            data-alca
            aria-label={snap === "expandido" ? "Recolher painel" : "Expandir painel"}
            aria-expanded={snap !== "recolhido"}
            aria-controls="folha-conteudo"
            onClick={() => onSnap(snap === "expandido" ? "recolhido" : ORDER[idx + 1])}
            className="flex h-3 w-full items-center justify-center"
          >
            <span aria-hidden className="h-0.5 w-5 rounded-full bg-ink-muted/60" />
          </button>
          <h2 id="folha-titulo" ref={headingRef} tabIndex={-1} className="sr-only">
            {title}
          </h2>
          {peek && <div className="px-2 pb-1.5">{peek}</div>}
        </div>
        <div
          id="folha-conteudo"
          hidden={snap === "recolhido"}
          className="min-h-0 overflow-y-auto overscroll-contain px-2 pb-2"
          style={{ maxHeight: maxH }}
        >
          {children}
        </div>
      </Card>
    </section>
  );
}
