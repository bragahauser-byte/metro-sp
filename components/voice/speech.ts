"use client";

// Acesso às APIs de voz do navegador (Web Speech). Nada é enviado por este site: o reconhecimento
// usa o serviço do próprio navegador, e o navegador pode processar o áudio no servidor dele.

type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type RecognitionCtor = new () => Recognition;

export function getRecognition(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Voz em português do Brasil, se o aparelho tiver; senão a padrão. */
export function ptVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === "pt-BR") ?? voices.find((v) => v.lang.startsWith("pt")) ?? null;
}

export const RECOGNITION_ERRORS: Record<string, string> = {
  "not-allowed": "O navegador não deu acesso ao microfone. Você pode digitar as estações.",
  "service-not-allowed": "O reconhecimento de voz está desligado neste navegador. Você pode digitar as estações.",
  "no-speech": "Não ouvi nada. Tente de novo ou digite as estações.",
  "audio-capture": "Nenhum microfone encontrado. Você pode digitar as estações.",
  network: "O reconhecimento de voz precisa de internet. Você pode digitar as estações.",
};

/** Bipe curto e baixo (sinal sonoro opcional para avisos). */
export function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    osc.onended = () => ctx.close();
  } catch {}
}
