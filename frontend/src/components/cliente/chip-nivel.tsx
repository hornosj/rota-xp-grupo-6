import { ArrowUpRight, Trophy } from "lucide-react";
import type { NivelJornada } from "@/lib/api-types";
import { cn } from "@/lib/utils";

export function ChipNivel({ nivel, className }: { nivel: NivelJornada; className?: string }) {
  return (
    <div className={cn("rounded-2xl border bg-card p-4", className)}>
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Trophy className="size-5" />
        </div>
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Nível {nivel.numero} de 4</p>
          <p className="text-lg leading-tight font-bold">{nivel.nome}</p>
        </div>
        <div className="ml-auto flex gap-1" aria-hidden>
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className={cn("h-2 w-5 rounded-full", n <= nivel.numero ? "bg-emerald-500" : "bg-slate-200")} />
          ))}
        </div>
      </div>
      {nivel.comoSubir && (
        <p className="mt-3 flex items-start gap-1.5 text-sm text-slate-700">
          <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          <span>
            {nivel.proximo && <span className="font-medium">Para chegar a {nivel.proximo}: </span>}
            {nivel.comoSubir}
          </span>
        </p>
      )}
      {nivel.beneficios.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {nivel.beneficios.map((b) => (
            <li key={b} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {b}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
