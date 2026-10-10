import { ChevronRight, Lock, Sparkles } from "lucide-react";
import type { Diagnostico } from "@/lib/api-types";
import { cn } from "@/lib/utils";

export function CardDiagnostico({
  diagnostico,
  onAbrir,
  recemDesbloqueado,
}: {
  diagnostico: Diagnostico;
  onAbrir?: (d: Diagnostico) => void;
  recemDesbloqueado?: boolean;
}) {
  const ok = diagnostico.desbloqueado;
  return (
    <button
      type="button"
      data-testid={`diagnostico-${diagnostico.tipo}`}
      data-desbloqueado={String(ok)}
      disabled={!ok}
      onClick={() => ok && onAbrir?.(diagnostico)}
      className={cn(
        "flex h-full flex-col items-start rounded-2xl border p-3 text-left transition",
        ok ? "border-emerald-200 bg-white hover:border-emerald-400 hover:shadow-sm" : "cursor-not-allowed border-dashed bg-slate-50",
        recemDesbloqueado && "animate-desbloqueio",
      )}
    >
      <div className="flex w-full items-center gap-1.5">
        {ok ? (
          <Sparkles className="size-4 text-emerald-600" />
        ) : (
          <Lock aria-label="Bloqueado" role="img" className="size-4 text-slate-400" />
        )}
        <span className={cn("text-sm font-semibold", !ok && "text-slate-500")}>{diagnostico.titulo}</span>
        {ok && <ChevronRight className="ml-auto size-4 text-slate-400" />}
      </div>
      <p className={cn("mt-1.5 text-sm", ok ? "font-medium text-slate-900" : "text-xs text-slate-500")}>
        {ok ? (diagnostico.resumo ?? "Toque para ver") : diagnostico.requisito}
      </p>
    </button>
  );
}
