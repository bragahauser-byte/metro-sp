// Imagem de compartilhamento (Open Graph) no visual do site: faixas paralelas nas cores das linhas,
// título grande e os ícones das linhas com número branco. Gerada no build.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { lineById } from "@/components/map/network";

export const OG_SIZE = { width: 1200, height: 630 };

const interBold = readFile(join(process.cwd(), "assets/fonts/Inter-Bold.ttf"));

type Props = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** Linhas para os ícones e para as faixas da direita. */
  lines: string[];
  /** Fundo do bloco de título (cor da linha nas páginas de linha). */
  accent?: string;
};

export async function ogImage({ eyebrow, title, subtitle, lines, accent }: Props) {
  const bands = (lines.length ? lines : ["1", "2", "3", "4", "5", "6", "15", "17"]).slice(0, 8);
  const ink = accent ? "#ffffff" : "#111111";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#f5f5f5", fontFamily: "Inter" }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 64,
            background: accent ?? "#f5f5f5",
            color: ink,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30 }}>
            <span
              style={{
                width: 48,
                height: 48,
                borderRadius: 999,
                background: ink,
                color: accent ?? "#f5f5f5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              M
            </span>
            Metrô
            <span style={{ fontSize: 16, background: ink, color: accent ?? "#f5f5f5", padding: "4px 10px", borderRadius: 999 }}>BETA</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <span style={{ fontSize: 24, letterSpacing: 4, textTransform: "uppercase", opacity: 0.75 }}>{eyebrow}</span>
            <span style={{ fontSize: title.length > 22 ? 64 : 84, lineHeight: 1, letterSpacing: -2 }}>{title}</span>
            {subtitle && <span style={{ fontSize: 28, opacity: 0.8 }}>{subtitle}</span>}
            {lines.length > 0 && (
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                {lines.map((l) => (
                  <span
                    key={l}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 999,
                      background: lineById.get(l)?.cor,
                      color: "#ffffff",
                      fontSize: l.length > 1 ? 24 : 30,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: accent ? "4px solid #ffffff" : "none",
                    }}
                  >
                    {l}
                  </span>
                ))}
              </div>
            )}
          </div>
          <span style={{ fontSize: 18, opacity: 0.7 }}>Projeto conceitual independente · não oficial</span>
        </div>
        {/* Faixas paralelas com fio branco, como no Live Subway Map de perto. */}
        <div style={{ width: 360, display: "flex", gap: 10, padding: "0 0 0 10px", background: "#f5f5f5" }}>
          {bands.map((l) => (
            <div key={l} style={{ flex: 1, display: "flex", gap: 4 }}>
              <div style={{ flex: 1, background: lineById.get(l)?.cor }} />
              <div style={{ flex: 1, background: lineById.get(l)?.cor }} />
            </div>
          ))}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: [{ name: "Inter", data: await interBold, style: "normal", weight: 700 }] },
  );
}
