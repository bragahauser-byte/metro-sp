import type { Metadata } from "next";
import { Hanken_Grotesk, Inter, Schibsted_Grotesk } from "next/font/google";
import { Button } from "@/components/ui/button";
import { DirectionPreview } from "@/components/ui/direction-preview";
import { LineBadge } from "@/components/ui/line-badge";
import { METRO_LINE_IDS, RAIL_LINE_IDS, getLine } from "@/components/ui/lines";
import { StationCard } from "@/components/ui/station-card";
import { StatusChip } from "@/components/ui/status-chip";

export const metadata: Metadata = { title: "Estilo" };

const inter = Inter({ subsets: ["latin"], display: "swap" });
const hanken = Hanken_Grotesk({ subsets: ["latin"], display: "swap" });
const schibsted = Schibsted_Grotesk({ subsets: ["latin"], display: "swap" });

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TYPE_SCALE = [
  ["text-hero", "Hero", "76px"],
  ["text-display", "Display", "61px"],
  ["text-title-l", "Título G", "39px"],
  ["text-title-m", "Título M", "31px"],
  ["text-title-s", "Título P", "25px"],
  ["text-lead", "Destaque", "20px"],
  ["text-body", "Corpo", "16px"],
  ["text-caption", "Legenda", "13px"],
] as const;

const SPACING = [0.5, 1, 2, 3, 4, 6, 8, 12];

const NEUTRALS = [
  ["--bg", "Fundo / basemap"],
  ["--surface", "Superfície"],
  ["--ink", "Tinta"],
  ["--ink-muted", "Tinta secundária"],
  ["--rule", "Fio"],
  ["--map-street", "Rua"],
  ["--map-park", "Parque"],
] as const;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-3 border-t border-rule-strong pt-3 md:grid-cols-[1fr_3fr]">
      <h2 id={id} className="text-lead font-bold tracking-tight">
        {title}
      </h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function LineRow({ id }: { id: string }) {
  const { nome, cor, tinta } = getLine(id);
  const ratio = contrast(cor, tinta);
  return (
    <li className="flex items-center gap-2 border-b border-rule py-1">
      <LineBadge line={id} />
      <span className="flex-1 text-body font-medium">{nome}</span>
      <code className="text-caption text-ink-muted">{cor}</code>
      <span className="w-10 text-right text-caption tabular-nums text-ink-muted">
        {tinta === "#FFFFFF" ? "branco" : "preto"} {ratio.toFixed(1)}:1
      </span>
    </li>
  );
}

export default function EstiloPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-2 py-6 sm:px-4">
      <header className="flex flex-col gap-2">
        <p className="text-caption font-medium uppercase tracking-widest text-ink-muted">Design system · Fase 1</p>
        <h1 className="text-title-l font-bold tracking-tight sm:text-display">Estilo</h1>
        <p className="max-w-[60ch] text-lead text-ink-muted">
          Os mesmos tokens e componentes em duas direções visuais. Use o botão de tema no topo para ver
          claro e escuro.
        </p>
      </header>

      <Section id="direcoes" title="Duas direções">
        <div className="grid gap-6 lg:grid-cols-2">
          <DirectionPreview direction="a" />
          <DirectionPreview direction="b" />
        </div>
      </Section>

      <Section id="linhas" title="Cores de linha">
        <p className="mb-2 max-w-[60ch] text-body text-ink-muted">
          Fonte: Guia Rápido da Identidade Visual do Metrô (REV.2, 2022), p. 26. O número usa a tinta
          (branca ou preta) com maior contraste; todas passam de 4,5:1.
        </p>
        <h3 className="mt-3 text-caption font-semibold uppercase tracking-widest text-ink-muted">Metrô e monotrilho</h3>
        <ul>{METRO_LINE_IDS.map((id) => <LineRow key={id} id={id} />)}</ul>
        <h3 className="mt-4 text-caption font-semibold uppercase tracking-widest text-ink-muted">
          Trens metropolitanos (camada opcional)
        </h3>
        <ul>{RAIL_LINE_IDS.map((id) => <LineRow key={id} id={id} />)}</ul>
        <div className="mt-4 flex flex-wrap items-end gap-2" aria-label="Tamanhos de badge">
          <LineBadge line="4" size="sm" />
          <LineBadge line="4" size="md" />
          <LineBadge line="4" size="lg" />
        </div>
      </Section>

      <Section id="neutros" title="Neutros">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {NEUTRALS.map(([token, label]) => (
            <li key={token} className="flex flex-col gap-1">
              <span className="h-8 border border-rule" style={{ background: `var(${token})` }} />
              <span className="text-caption font-semibold">{label}</span>
              <code className="text-caption text-ink-muted">{token}</code>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="tipografia" title="Tipografia">
        <p className="mb-3 max-w-[60ch] text-body text-ink-muted">
          Escala modular 1,25 sobre 16px. Helvetica Now é comercial e fica fora do site; as três candidatas
          livres abaixo têm licença OFL.
        </p>
        <ul className="flex flex-col">
          {TYPE_SCALE.map(([cls, label, px]) => (
            <li key={cls} className="flex items-baseline gap-2 overflow-hidden border-b border-rule py-1">
              <span className="w-10 shrink-0 text-caption text-ink-muted">
                {label} · {px}
              </span>
              <span className={`${cls} truncate font-bold tracking-tight`}>Consolação</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            ["Inter", inter.className, "Recomendada: desenho próximo da Helvetica Now, ótima em tela pequena."],
            ["Hanken Grotesk", hanken.className, "Mais geométrica, um pouco mais calorosa."],
            ["Schibsted Grotesk", schibsted.className, "Grotesca de jornal, mais contraste e personalidade."],
          ].map(([name, cls, note]) => (
            <figure key={name} className={`${cls} flex flex-col gap-1 border-t border-rule pt-2`}>
              <p className="text-title-m font-bold leading-none tracking-tight">Brigadeiro</p>
              <p className="text-body">Ana Rosa · Vila Madalena · Tamanduateí</p>
              <p className="text-caption tabular-nums">1 2 3 4 5 6 15 17</p>
              <figcaption className="font-sans text-caption text-ink-muted">
                <strong className="text-ink">{name}.</strong> {note}
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section id="espaco" title="Grid de 8px">
        <ul className="flex flex-col gap-1">
          {SPACING.map((n) => (
            <li key={n} className="flex items-center gap-2">
              <span className="w-6 text-caption tabular-nums text-ink-muted">{n * 8}px</span>
              <span className="h-1 bg-ink" style={{ width: n * 8 }} />
            </li>
          ))}
        </ul>
      </Section>

      <Section id="componentes" title="Componentes">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1">
            <Button>Primário</Button>
            <Button variant="secondary">Secundário</Button>
            <Button variant="ghost">Texto</Button>
            <Button disabled>Desativado</Button>
          </div>
          <div className="flex flex-wrap gap-1">
            <StatusChip status="operando" />
            <StatusChip status="operacao-assistida" />
            <StatusChip status="em-obras" />
            <StatusChip status="planejada" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <StationCard name="Consolação" lines={["2"]} status="operando" integrations={["Paulista (Linha 4)"]} />
            <StationCard name="Sé" lines={["1", "3"]} status="operando" />
          </div>
        </div>
      </Section>

      <Section id="movimento" title="Movimento">
        <dl className="grid grid-cols-2 gap-2 text-body sm:grid-cols-4">
          {[
            ["Rápido", "120ms", "hover, toque"],
            ["Base", "200ms", "abrir cartão"],
            ["Lento", "400ms", "morph do mapa"],
            ["Curva", "cubic-bezier(.2,0,0,1)", "padrão"],
          ].map(([k, v, use]) => (
            <div key={k} className="border-t border-rule pt-1">
              <dt className="text-caption text-ink-muted">{k}</dt>
              <dd className="font-semibold">{v}</dd>
              <dd className="text-caption text-ink-muted">{use}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-caption text-ink-muted">
          Com “reduzir movimento” ativado no sistema, todas as durações vão a zero.
        </p>
      </Section>

    </main>
  );
}
