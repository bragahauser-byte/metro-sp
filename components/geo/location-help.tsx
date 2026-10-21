"use client";

import { useState } from "react";
import { IconButton, Icons, Spinner } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GEO_MESSAGES } from "./use-geolocation";
import { type GeoState, type Permission } from "./location";

export const LOCATION_NOTICE = "Para traçar sua rota, o Metrô SP usa sua localização. Ela não sai do seu aparelho.";

/** Como liberar depois de negar: o navegador não pergunta de novo sozinho. */
export function LocationHowTo() {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p>O navegador bloqueou a localização para este site e não pergunta de novo. Para liberar:</p>
      <ul className="flex list-disc flex-col gap-0.5 pl-2">
        <li>
          <strong>Chrome</strong> (Android ou computador): toque no ícone à esquerda do endereço → <em>Permissões</em> (ou{" "}
          <em>Configurações do site</em>) → <em>Localização</em> → <em>Permitir</em>.
        </li>
        <li>
          <strong>Safari</strong> (iPhone): toque em <em>aA</em> na barra de endereço → <em>Ajustes do Site</em> → <em>Localização</em> →{" "}
          <em>Permitir</em>. Se não aparecer: Ajustes → Privacidade e Segurança → Serviços de Localização → Safari.
        </li>
        <li>Depois, recarregue a página.</li>
      </ul>
    </div>
  );
}

/**
 * Aviso curto da abertura, mostrado antes (e durante) o pedido do navegador. Some sozinho quando a
 * pessoa responde; se negar, diz que dá para seguir pela busca.
 */
export function LocationNotice({ geo, onClose }: { geo: GeoState; onClose: () => void }) {
  const denied = geo.status === "error";
  return (
    <Card className="pointer-events-auto flex w-full max-w-[420px] items-start gap-1 p-1.5" role="status" aria-live="polite">
      <span aria-hidden className="mt-0.5 text-fg-link">
        {Icons.gps}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm font-semibold">{LOCATION_NOTICE}</p>
        {geo.status === "locating" && (
          <p className="flex items-center gap-1 text-xs text-ink-muted">
            <Spinner /> Responda ao pedido do navegador.
          </p>
        )}
        {denied && <p className="text-xs text-ink-muted">{GEO_MESSAGES[geo.reason]}</p>}
      </div>
      <IconButton variant="plain" label="Fechar aviso de localização" onClick={onClose} className="-my-1 -mr-1">
        {Icons.close}
      </IconButton>
    </Card>
  );
}

/** "Usar minha localização": pede a posição; se o navegador já bloqueou, explica como liberar. */
export function UseLocationButton({
  permission,
  geo,
  onUse,
  help: helpProp,
  onHelp,
}: {
  permission: Permission;
  geo: GeoState;
  onUse: () => void;
  /** Controlado por quem usa (para não mostrar a ajuda duas vezes). */
  help?: boolean;
  onHelp?: (v: boolean) => void;
}) {
  const [helpState, setHelpState] = useState(false);
  const help = helpProp ?? helpState;
  const setHelp = (f: (h: boolean) => boolean) => (onHelp ? onHelp(f(help)) : setHelpState(f));
  const blocked = permission === "denied" || (geo.status === "error" && geo.reason === "denied");
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => (blocked ? setHelp((h) => !h) : onUse())}
        aria-expanded={blocked ? help : undefined}
        className="flex min-h-control items-center gap-1 self-start text-sm font-semibold text-fg-link"
      >
        {Icons.gps} Usar minha localização
      </button>
      {blocked && help && <LocationHowTo />}
    </div>
  );
}
