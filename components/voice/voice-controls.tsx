"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { IconButton, Icons, Spinner } from "@/components/ui/button";
import { lineById, stationBySlug, stations } from "@/components/map/network";
import { type RouteIntent, parseRouteIntent } from "@/lib/voice/parse-route";
import { type WalkLegs, describeRoute } from "@/lib/voice/describe-route";
import type { RouteOption } from "@/lib/route/engine";
import { RECOGNITION_ERRORS, canSpeak, getRecognition, ptVoice } from "./speech";

const noop = () => () => {};
/** true só no navegador e só se a API existir (no servidor, sempre false: sem divergência de hidratação). */
function useSupported(check: () => boolean) {
  return useSyncExternalStore(noop, check, () => false);
}

/**
 * Microfone: ouve uma frase ("da estação São Lucas até Tatuapé") e devolve as estações entendidas.
 * Se o navegador não tiver reconhecimento de voz, o botão nem aparece — o texto sempre funciona.
 */
export function VoiceRouteButton({
  onIntent,
  compact = false,
}: {
  onIntent: (intent: RouteIntent, heard: string) => void | Promise<void>;
  /** Só o ícone (no cabeçalho da busca); a mensagem de estado vira dica do botão e anúncio. */
  compact?: boolean;
}) {
  const supported = useSupported(() => getRecognition() !== null);
  const [state, setState] = useState<"idle" | "listening" | "error">("idle");
  const [message, setMessage] = useState("");
  const rec = useRef<{ abort: () => void } | null>(null);

  useEffect(() => () => rec.current?.abort(), []);

  if (!supported) return null;

  function start() {
    const Ctor = getRecognition();
    if (!Ctor) return;
    if (state === "listening") {
      rec.current?.abort();
      setState("idle");
      setMessage("");
      return;
    }
    const r = new Ctor();
    r.lang = "pt-BR";
    r.interimResults = false;
    r.continuous = false;
    r.maxAlternatives = 3;
    r.onresult = (e) => {
      const alts = Array.from(e.results[0]).map((a) => a.transcript);
      // Fica com a primeira alternativa que achou alguma estação (ou, senão, a mais provável).
      const parsed = alts.map((t) => ({ t, i: parseRouteIntent(t, stations) }));
      const best = parsed.find((p) => p.i.de || p.i.para) ?? parsed[0];
      onIntent(best.i, best.t);
      setMessage(`Ouvi: “${best.t}”.`);
      setState("idle");
    };
    r.onerror = (e) => {
      setState("error");
      setMessage(RECOGNITION_ERRORS[e.error] ?? "Não deu para usar a voz agora. Você pode digitar as estações.");
    };
    r.onend = () => setState((s) => (s === "listening" ? "idle" : s));
    rec.current = r;
    setMessage("Ouvindo… diga, por exemplo: “de Rua Otávio Alves Dundas até Shopping Eldorado”.");
    setState("listening");
    r.start();
  }

  const button = (
    <IconButton
      variant={compact ? "plain" : "floating"}
      label={state === "listening" ? "Parar de ouvir" : "Falar a rota (origem e destino)"}
      aria-pressed={state === "listening"}
      onClick={start}
      className={state === "listening" ? "!bg-ink !text-bg" : ""}
    >
      {state === "listening" ? <Spinner className="size-icon" /> : Icons.mic}
    </IconButton>
  );
  if (compact) {
    return (
      <>
        {button}
        <p role="status" className="sr-only">
          {message}
        </p>
        {state !== "idle" && message && (
          <p className="absolute inset-x-2 top-full z-10 mt-0.5 bg-surface p-1 text-xs text-ink-muted shadow-(--shadow-card)" style={{ borderRadius: 8 }} aria-hidden>
            {message}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <IconButton
          label={state === "listening" ? "Parar de ouvir" : "Dizer origem e destino"}
          aria-pressed={state === "listening"}
          onClick={start}
          className={state === "listening" ? "!bg-ink !text-bg" : ""}
        >
          {state === "listening" ? <Spinner className="size-icon" /> : Icons.mic}
        </IconButton>
        <span className="text-sm text-ink-muted">{state === "listening" ? "Ouvindo…" : "Falar a rota"}</span>
      </div>
      <p role="status" className="text-xs text-ink-muted">
        {message}
      </p>
    </div>
  );
}

/** Ler a rota em voz alta, com começar, pausar, continuar e parar. */
export function RouteSpeech({ route, detalhe, walk }: { route: RouteOption; detalhe: "resumido" | "completo"; walk?: WalkLegs }) {
  const supported = useSupported(canSpeak);
  const [state, setState] = useState<"idle" | "speaking" | "paused">("idle");

  // Rota nova ou componente saindo de cena: para a fala anterior.
  useEffect(() => {
    return () => {
      if (canSpeak()) window.speechSynthesis.cancel();
    };
  }, [route]);

  if (!supported) return null;

  function play() {
    const synth = window.speechSynthesis;
    synth.cancel();
    const lines = describeRoute(route, { station: (s) => stationBySlug.get(s)?.nome ?? s, line: (l) => lineById.get(l)?.nome ?? `Linha ${l}` }, detalhe, walk);
    const voice = ptVoice();
    lines.forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "pt-BR";
      if (voice) u.voice = voice;
      u.rate = 1;
      if (i === lines.length - 1) u.onend = () => setState("idle");
      u.onerror = () => setState("idle");
      synth.speak(u);
    });
    setState("speaking");
  }

  const btn = "inline-flex h-control items-center gap-1 border border-rule-strong px-2 text-sm font-semibold hover:bg-ink/5 active:bg-ink/10";
  const radius = { borderRadius: "var(--radius-control)" };
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Ouvir a rota">
      {state === "idle" && (
        <button type="button" className={btn} style={radius} onClick={play}>
          <span aria-hidden>▶</span> Ouvir a rota
        </button>
      )}
      {state === "speaking" && (
        <button
          type="button"
          className={btn}
          style={radius}
          onClick={() => {
            window.speechSynthesis.pause();
            setState("paused");
          }}
        >
          <span aria-hidden>❚❚</span> Pausar
        </button>
      )}
      {state === "paused" && (
        <button
          type="button"
          className={btn}
          style={radius}
          onClick={() => {
            window.speechSynthesis.resume();
            setState("speaking");
          }}
        >
          <span aria-hidden>▶</span> Continuar
        </button>
      )}
      {state !== "idle" && (
        <button
          type="button"
          className={btn}
          style={radius}
          onClick={() => {
            window.speechSynthesis.cancel();
            setState("idle");
          }}
        >
          <span aria-hidden>■</span> Parar
        </button>
      )}
    </div>
  );
}
