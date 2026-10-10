import { AlertTriangle, Info } from "lucide-react";
import { ChipSeveridade, TagNovo, Vazio, corSeveridade } from "@/components/comum/marcadores";
import type { Alerta, Severidade } from "@/lib/api-types";
import { brl } from "@/lib/formato";
import { rotuloTipoAlerta } from "@/lib/rotulos";
import { cn } from "@/lib/utils";

const ordem: Record<Severidade, number> = { ALTA: 0, MEDIA: 1, BAIXA: 2 };

export function ListaAlertas({ alertas }: { alertas: Alerta[] }) {
  if (!alertas.length) return <Vazio>Nenhum alerta para este cliente. Tudo em ordem.</Vazio>;
  const ordenados = [...alertas].sort(
    (a, b) => ordem[a.severidade] - ordem[b.severidade] || Number(b.novo) - Number(a.novo),
  );
  return (
    <ul className="flex flex-col gap-2">
      {ordenados.map((a) => (
        <li
          key={a.id}
          data-testid="alerta"
          data-severidade={a.severidade}
          className={cn(
            "rounded-lg border p-3",
            corSeveridade[a.severidade].borda,
            a.novo && "animate-entrada",
          )}
        >
          <div className="flex items-start gap-3">
            {a.severidade === "ALTA" ? (
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-600" />
            ) : (
              <Info className={cn("mt-0.5 size-5 shrink-0", a.severidade === "MEDIA" ? "text-amber-600" : "text-slate-400")} />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{a.titulo}</span>
                {a.novo && <TagNovo />}
              </div>
              <p className="mt-1 text-sm text-slate-700">{a.explicacao}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <ChipSeveridade severidade={a.severidade} />
                <span>{rotuloTipoAlerta[a.tipo] ?? a.tipo}</span>
              </div>
            </div>
            {a.valor != null && (
              <div className="shrink-0 text-right text-lg font-bold tabular-nums">{brl(a.valor, { inteiro: true })}</div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
