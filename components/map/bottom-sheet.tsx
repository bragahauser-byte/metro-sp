"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { IconButton, Icons } from "@/components/ui/button";
import { prefersReducedMotion } from "@/lib/prefs";

type Snap = "parcial" | "expandida";

/** Arrasto para baixo maior que isto (ou mais rápido que CLOSE_VELOCITY) fecha a folha. */
const CLOSE_DISTANCE = 120;
const CLOSE_VELOCITY = 0.6; // px/ms
const EXPAND_DISTANCE = 60;

/**
 * Folha que sobe no celular (como no Live Subway Map). Estados: parcial, expandida, arrastando e
 * fechada (desmontada). O arrasto vale só na alça/cabeçalho, então não briga com a rolagem do
 * conteúdo nem com o gesto do mapa. Arrasto curto volta ao lugar. O botão de fechar continua lá,
 * Esc fecha, e o foco volta para o botão que abriu a folha.
 */
export function BottomSheet({
  title,
  onClose,
  children,
  focusOnOpen = true,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  focusOnOpen?: boolean;
}) {
  const [snap, setSnap] = useState<Snap>("parcial");
  const [dragY, setDragY] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);
  const drag = useRef<{ startY: number; lastY: number; lastT: number; v: number; id: number } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  // Foco: entra no título ao abrir e volta para quem abriu ao fechar.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    if (focusOnOpen) heading.current?.focus({ preventScroll: true });
    return () => {
      if (opener && opener.isConnected && opener !== document.body) opener.focus({ preventScroll: true });
    };
  }, [focusOnOpen]);

  function close() {
    if (prefersReducedMotion()) return onClose();
    setClosing(true);
    setTimeout(onClose, 200);
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button:not([data-alca])") || e.button !== 0) return;
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
    // Para cima resiste (efeito elástico); para baixo acompanha o dedo.
    setDragY(dy < 0 ? dy * 0.35 : dy);
  }
  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const dy = e.clientY - d.startY;
    setDragY(null);
    if (Math.abs(dy) < 6) return; // foi um toque, não um arrasto
    if (dy > 0 && snap === "expandida" && dy < CLOSE_DISTANCE * 2 && d.v < CLOSE_VELOCITY) return setSnap("parcial");
    if (dy > CLOSE_DISTANCE || d.v > CLOSE_VELOCITY) return close();
    if (dy < -EXPAND_DISTANCE || d.v < -CLOSE_VELOCITY) return setSnap("expandida");
    // Senão, volta ao lugar (dragY = null).
  }

  // Com "reduzir movimento", a duração da transição vai a zero pelos tokens (sem ler o DOM no render).
  const animated = dragY === null;
  const offset = closing ? "110%" : dragY !== null ? `${dragY}px` : "0px";

  return (
    <section
      id="folha-do-mapa"
      aria-labelledby="folha-titulo"
      className="pointer-events-auto md:hidden"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          close();
        }
      }}
    >
      <Card
        className={`anim-sheet mx-1 flex min-h-0 flex-col ${animated ? "sheet-snap" : ""}`}
        style={{
          borderRadius: "var(--radius-sheet) var(--radius-sheet) var(--radius-card) var(--radius-card)",
          transform: `translateY(${offset})`,
          maxHeight: snap === "expandida" ? "calc(100dvh - 120px)" : "62vh",
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
            aria-label={snap === "expandida" ? "Recolher painel" : "Expandir painel"}
            aria-expanded={snap === "expandida"}
            onClick={() => setSnap((s) => (s === "expandida" ? "parcial" : "expandida"))}
            className="flex h-3 w-full items-center justify-center"
          >
            <span aria-hidden className="h-0.5 w-5 rounded-full bg-rule-strong/40" />
          </button>
          <div className="flex items-center justify-between pl-2 pr-0.5">
            <h2 id="folha-titulo" ref={heading} tabIndex={-1} className="text-xs font-semibold uppercase text-ink-muted focus:outline-none">
              {title}
            </h2>
            <IconButton variant="plain" label="Fechar painel" onClick={close}>
              {Icons.close}
            </IconButton>
          </div>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-2 pb-2">{children}</div>
      </Card>
    </section>
  );
}
