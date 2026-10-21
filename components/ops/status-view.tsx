"use client";

import { LineBadge } from "@/components/ui/line-badge";
import { Spinner } from "@/components/ui/button";
import { BackButton } from "@/components/map/panels";
import { lineById, lines } from "@/components/map/network";
import { FULL_SITE_URL } from "@/lib/env";
import { CHANNELS, STATUS_SOURCES } from "@/lib/ops/sources";
import { ARTESP_ATTRIBUTION, type LineStatus, type Situacao, isAlert } from "@/lib/ops/status";
import { type OpsState, useOps } from "./use-ops";

const timeFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

const LABEL: Record<Situacao, { texto: string; cls: string }> = {
  normal: { texto: "Operação normal", cls: "text-fg-success" },
  atencao: { texto: "Atenção", cls: "text-fg-warning" },
  paralisada: { texto: "Paralisada", cls: "text-fg-danger" },
  encerrada: { texto: "Operação encerrada", cls: "text-ink-muted" },
  desconhecida: { texto: "Situação não reconhecida", cls: "text-ink-muted" },
};

/** Situação de cada linha que tem fonte de máquina (o resto: null). */
export function statusByLine(ops: OpsState): Map<string, LineStatus> {
  const m = new Map<string, LineStatus>();
  if (ops.status === "ok") for (const s of ops.data.situacao?.linhas ?? []) m.set(s.linha, s);
  return m;
}

/** Quantas linhas pedem atenção agora (para o botão de avisos). */
export function alertLines(ops: OpsState): number {
  return ops.status === "ok" ? (ops.data.situacao?.linhas ?? []).filter(isAlert).length : 0;
}

function SituationText({ s }: { s: LineStatus }) {
  const l = LABEL[s.situacao];
  return (
    <span className={`inline-flex items-center gap-0.5 text-sm font-semibold ${l.cls}`}>
      <span aria-hidden className="inline-block size-1 rounded-full" style={{ background: "currentColor" }} />
      {/* O texto da fonte vale mais que a nossa classificação: mostramos o dela. */}
      {s.texto || l.texto}
    </span>
  );
}

function channelsFor(id: string) {
  return CHANNELS.filter((c) => c.linhas.includes(id));
}

/** Por que uma linha está sem leitura automática agora. */
type Why = "sem-fonte" | "sem-chave" | "falhou" | "estatico";
const WHY: Record<Why, string> = {
  "sem-fonte": "a operadora não publica a situação em formato aberto",
  "sem-chave": "aguardando a chave da API da ARTESP",
  falhou: "a fonte não respondeu agora",
  estatico: "a versão estática não tem servidor",
};

function LineRow({ id, s, why }: { id: string; s: LineStatus | null; why: Why }) {
  const line = lineById.get(id)!;
  const ch = channelsFor(id)[0];
  return (
    <li className="flex gap-1.5 border-b border-rule py-1.5 last:border-0">
      <LineBadge line={id} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-base font-bold">{line.nome}</span>
        {s ? (
          <>
            <SituationText s={s} />
            {s.detalhe && s.detalhe !== s.texto && <span className="text-sm text-ink-muted">{s.detalhe}</span>}
            <span className="text-xs text-ink-muted">
              {s.fonte.id === "artesp" ? ARTESP_ATTRIBUTION : s.fonte.nome}
              {s.atualizadoEm && ` · atualizado às ${timeFmt.format(new Date(s.atualizadoEm))}`}
              {s.preservado && " · última leitura válida"}
            </span>
          </>
        ) : (
          <span className="text-sm text-ink-muted">
            Sem leitura automática ({WHY[why]}).{" "}
            {ch && (
              <a className="font-semibold text-fg-link underline" href={ch.url}>
                Ver em {ch.nome.split(" — ")[0]}
              </a>
            )}
          </span>
        )}
      </div>
    </li>
  );
}

/** Canais para conferir com os próprios olhos (TemTrem, ARTESP, Metrô, CPTM, concessionárias). */
export function Channels() {
  return (
    <section aria-labelledby="canais" className="flex flex-col gap-1">
      <h3 id="canais" className="text-xs font-semibold uppercase text-ink-muted">
        Onde conferir
      </h3>
      <ul className="flex flex-col">
        {CHANNELS.map((c) => (
          <li key={c.url} className="border-b border-rule last:border-0">
            <a href={c.url} className="group flex min-h-control items-center justify-between gap-1 py-0.5">
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold group-hover:underline">{c.nome}</span>
                {(c.nota || c.linhas.length > 0) && (
                  <span className="text-xs text-ink-muted">{c.nota ?? `linhas ${c.linhas.join(", ")}`}</span>
                )}
              </span>
              <span aria-hidden className="text-ink-muted">
                ↗
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Painel "Agora": a situação de cada linha em operação, lida a cada 15 minutos. */
export function NowView({ onBack }: { onBack: () => void }) {
  const ops = useOps();
  const byLine = statusByLine(ops);
  const sources = ops.status === "ok" ? (ops.data.situacao?.fontes ?? []) : [];
  const why = (id: string): Why => {
    if (ops.status === "static") return "estatico";
    const src = STATUS_SOURCES.find((s) => s.linhas.includes(id));
    if (!src) return "sem-fonte";
    const f = sources.find((x) => x.id === src.id);
    return f?.desligada ? "sem-chave" : "falhou";
  };
  const running = lines.filter((l) => l.status === "operando" || l.status === "operacao-assistida");
  // Problemas primeiro; depois a ordem normal das linhas.
  const order = [...running].sort((a, b) => {
    const pa = byLine.get(a.id);
    const pb = byLine.get(b.id);
    const w = (s?: LineStatus) => (s ? (isAlert(s) ? 0 : 1) : 2);
    return w(pa) - w(pb) || Number(a.id) - Number(b.id);
  });
  const lastOk = sources.map((f) => f.ultimaColetaOkEm).filter(Boolean).sort().at(-1) ?? null;
  const failed = sources.filter((f) => !f.ok && !f.desligada);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <BackButton onClick={onBack} />
        <div>
          <h2 className="text-lg font-bold">Agora</h2>
          <p className="text-xs text-ink-muted">Situação das linhas, conferida a cada 15 min</p>
        </div>
      </div>

      {ops.status === "static" && (
        <p className="text-sm text-ink-muted">
          A situação em tempo real precisa de servidor, que esta versão estática não tem. Veja na{" "}
          <a className="font-semibold underline" href={FULL_SITE_URL}>
            versão completa
          </a>{" "}
          ou nos canais abaixo.
        </p>
      )}
      {ops.status === "loading" && (
        <p className="flex items-center gap-1 text-sm text-ink-muted">
          <Spinner /> Conferindo a situação das linhas…
        </p>
      )}
      {ops.status === "error" && (
        <p className="text-sm text-ink-muted">
          Não foi possível conferir agora.{" "}
          <button type="button" onClick={ops.retry} className="inline-flex min-h-control items-center font-semibold underline">
            Tentar de novo
          </button>
        </p>
      )}
      <ul className="flex flex-col" aria-label="Situação por linha" aria-busy={ops.status === "loading"}>
        {order.map((l) => (
          <LineRow key={l.id} id={l.id} s={byLine.get(l.id) ?? null} why={why(l.id)} />
        ))}
      </ul>
      {ops.status === "ok" && (
        <p className="text-xs text-ink-muted">
          {lastOk ? <>Última leitura bem-sucedida às {timeFmt.format(new Date(lastOk))}.</> : "Nenhuma leitura bem-sucedida ainda."}
          {failed.length > 0 && ` Fonte indisponível agora: ${failed.map((f) => f.nome).join(", ")}.`}
          {sources.some((f) => f.id === "artesp" && f.ok) && ` ${ARTESP_ATTRIBUTION} — Centro de Controle Multimodal.`}
        </p>
      )}
      <Channels />
    </div>
  );
}
