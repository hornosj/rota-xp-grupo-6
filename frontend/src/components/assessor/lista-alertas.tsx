import { ChipSeveridade, TagNovo, Vazio } from "@/components/comum/marcadores";
import type { Alerta, Severidade } from "@/lib/api-types";
import { brl } from "@/lib/formato";
import { rotuloTipoAlerta } from "@/lib/rotulos";
import { cn } from "@/lib/utils";

const ordem: Record<Severidade, number> = { ALTA: 0, MEDIA: 1, BAIXA: 2 };

/** Ordena por severidade e, dentro dela, os novos primeiro. */
export function ordenarAlertas(alertas: Alerta[]) {
  return [...alertas].sort((a, b) => ordem[a.severidade] - ordem[b.severidade] || Number(b.novo) - Number(a.novo));
}

export function ListaAlertas({ alertas }: { alertas: Alerta[] }) {
  if (!alertas.length) return <Vazio>Nenhum alerta para este cliente. Tudo em ordem.</Vazio>;
  return (
    <ul className="flex flex-col divide-y">
      {ordenarAlertas(alertas).map((a) => (
        <li
          key={a.id}
          data-testid="alerta"
          data-severidade={a.severidade}
          className={cn("grid grid-cols-[minmax(0,1fr)_auto] gap-5 py-5 first:pt-0 last:pb-0", a.novo && "animate-entrada")}
        >
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <ChipSeveridade severidade={a.severidade} />
              <span className="text-lg font-bold">{a.titulo}</span>
              {a.novo && <TagNovo />}
            </div>
            <p className="text-[17px] leading-relaxed text-[#333]">{a.explicacao}</p>
            <p className="text-sm text-muted-foreground">{rotuloTipoAlerta[a.tipo] ?? a.tipo}</p>
          </div>
          {a.valor != null && (
            <p className="text-right text-2xl font-extrabold tracking-tight">{brl(a.valor, { inteiro: true })}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
