import { Card } from "./card";
import { LineBadge } from "./line-badge";
import { StatusChip, type Status } from "./status-chip";

type Props = {
  name: string;
  lines: string[];
  status: Status;
  integrations?: string[];
};

export function StationCard({ name, lines, status, integrations = [] }: Props) {
  return (
    <Card className="flex flex-col gap-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-title-s font-bold tracking-tight">{name}</h3>
        <StatusChip status={status} />
      </div>
      <ul className="flex flex-wrap gap-0.5" aria-label="Linhas">
        {lines.map((id) => (
          <li key={id}>
            <LineBadge line={id} />
          </li>
        ))}
      </ul>
      {integrations.length > 0 && (
        <p className="border-t border-rule pt-2 text-caption text-ink-muted">
          Integração: {integrations.join(", ")}
        </p>
      )}
    </Card>
  );
}
