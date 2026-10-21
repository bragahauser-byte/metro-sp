import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { CompositionPreview } from "@/components/ui/composition-preview";
import { LineBadge } from "@/components/ui/line-badge";
import { METRO_LINE_IDS, RAIL_LINE_IDS, getLine } from "@/components/ui/lines";
import { StationCard } from "@/components/ui/station-card";
import { StatusChip } from "@/components/ui/status-chip";

export const metadata: Metadata = { title: "Estilo" };

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

// Escala única do site: tamanho / altura de linha / espaçamento entre letras (styles/tokens.css).
const TYPE_SCALE = [
  ["text-2xl", "Título 1", "28/36 · −0,5"],
  ["text-xl", "Título 2", "24/32 · −0,4"],
  ["text-lg", "Destaque", "20/28 · −0,2"],
  ["text-base", "Corpo", "16/24 · 0"],
  ["text-sm", "Apoio", "14/20 · 0"],
  ["text-xs", "Legenda", "12/16 · +0,1"],
] as const;

const WEIGHTS = [
  ["font-normal", "Regular 400"],
  ["font-medium", "Medium 500"],
  ["font-semibold", "Semibold 600"],
  ["font-bold", "Bold 700"],
] as const;

const TEXT_COLORS = [
  ["text-fg", "--fg-primary", "texto principal"],
  ["text-fg-muted", "--fg-secondary", "apoio, legendas"],
  ["text-fg-link", "--fg-link", "links fora do texto corrido"],
  ["text-fg-success", "--fg-success", "funciona no horário"],
  ["text-fg-warning", "--fg-warning", "não verificado"],
  ["text-fg-danger", "--fg-danger", "impossível no horário"],
  ["text-fg-disabled", "--fg-disabled", "desativado (sem exigência de contraste)"],
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
      <h2 id={id} className="text-lg font-bold">
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
      <span className="flex-1 text-base font-medium">{nome}</span>
      <code className="text-xs text-ink-muted">{cor}</code>
      <span className="w-10 text-right text-xs tabular-nums text-ink-muted">
        branco {ratio.toFixed(1)}:1{ratio < 4.5 ? "*" : ""}
      </span>
    </li>
  );
}

export default function EstiloPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-2 py-6 sm:px-4">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase text-ink-muted">Design system · Fase 1</p>
        <h1 className="text-2xl font-bold">Estilo</h1>
        <p className="max-w-[60ch] text-lg text-ink-muted">
          Direção “Mapa vivo”: o mapa ocupa a tela, tudo o mais flutua sobre ele, e a cor só aparece nas
          linhas. Use o botão de tema no topo para ver claro e escuro.
        </p>
      </header>

      <Section id="composicao" title="Composição">
        <CompositionPreview />
      </Section>

      <Section id="linhas" title="Cores de linha">
        <p className="mb-2 max-w-[60ch] text-base text-ink-muted">
          Fonte: Guia Rápido da Identidade Visual do Metrô (REV.2, 2022), p. 26. Número sempre branco e centralizado, como nos ícones das referências. Nas cores claras o
          contraste fica abaixo de 4,5:1 (marcado com *), então o ícone nunca é a única informação: ele leva
          o nome da linha como texto alternativo e aparece ao lado do nome por extenso.
        </p>
        <h3 className="mt-3 text-xs font-semibold uppercase text-ink-muted">Metrô e monotrilho</h3>
        <ul>{METRO_LINE_IDS.map((id) => <LineRow key={id} id={id} />)}</ul>
        <h3 className="mt-4 text-xs font-semibold uppercase text-ink-muted">
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
              <span className="text-xs font-semibold">{label}</span>
              <code className="text-xs text-ink-muted">{token}</code>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="tipografia" title="Tipografia">
        <p className="mb-3 max-w-[60ch] text-base text-ink-muted">
          Inter (licença OFL) em seis tamanhos — 12, 14, 16, 20, 24 e 28 px —, cada um com altura de linha e
          espaçamento próprios, e quatro pesos. Nada abaixo de 12 px. A Helvetica Now das referências é comercial e fica
          fora do site; a Inter é a alternativa livre de desenho mais próximo.
        </p>
        <ul className="flex flex-col">
          {TYPE_SCALE.map(([cls, label, px]) => (
            <li key={cls} className="flex items-baseline gap-2 overflow-hidden border-b border-rule py-1">
              <span className="w-10 shrink-0 text-xs text-ink-muted">
                {label} · {px}
              </span>
              <span className={`${cls} truncate font-bold`}>Consolação</span>
            </li>
          ))}
        </ul>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {WEIGHTS.map(([cls, label]) => (
            <li key={cls} className={`text-lg ${cls}`}>
              {label}
            </li>
          ))}
        </ul>
        <h3 className="mt-4 text-xs font-semibold uppercase text-ink-muted">Cores de texto</h3>
        <ul className="mt-1 grid gap-1 sm:grid-cols-2">
          {TEXT_COLORS.map(([cls, token, use]) => (
            <li key={token} className="flex items-baseline gap-1 border-b border-rule py-0.5">
              <span className={`${cls} text-base font-semibold`}>Aa</span>
              <code className="text-xs">{token}</code>
              <span className="text-xs text-ink-muted">{use}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="espaco" title="Grid de 8px">
        <ul className="flex flex-col gap-1">
          {SPACING.map((n) => (
            <li key={n} className="flex items-center gap-2">
              <span className="w-6 text-xs tabular-nums text-ink-muted">{n * 8}px</span>
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
            <Button variant="secondary" loading>
              Carregando
            </Button>
          </div>
          <p className="text-xs text-ink-muted">
            Toda área clicável tem pelo menos 48 × 48 px (token --spacing-control); ícones de 24 px ficam centralizados nela.
            Estados: hover, foco visível, pressionado, desativado e carregando.
          </p>
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
        <dl className="grid grid-cols-2 gap-2 text-base sm:grid-cols-4">
          {[
            ["Rápido", "120ms", "hover, toque"],
            ["Base", "200ms", "abrir cartão"],
            ["Lento", "400ms", "morph do mapa"],
            ["Curva", "cubic-bezier(.2,0,0,1)", "padrão"],
          ].map(([k, v, use]) => (
            <div key={k} className="border-t border-rule pt-1">
              <dt className="text-xs text-ink-muted">{k}</dt>
              <dd className="font-semibold">{v}</dd>
              <dd className="text-xs text-ink-muted">{use}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-ink-muted">
          Com “reduzir movimento” ativado no sistema ou nas preferências do site, todas as durações vão a zero.
        </p>
      </Section>

    </main>
  );
}
