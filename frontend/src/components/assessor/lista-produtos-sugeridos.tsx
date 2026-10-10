import { HeartHandshake, RefreshCw, ShieldCheck } from "lucide-react";
import type { RecomendacaoProduto } from "@/lib/api-types";
import { cn } from "@/lib/utils";

/**
 * Produtos do catálogo sugeridos pelas notas do assessor, com o trecho da nota que justifica.
 * Momento delicado (luto, doença, perda) vem primeiro e orienta a acolher antes de ofertar.
 */
export function ListaProdutosSugeridos({ recomendacoes }: { recomendacoes: RecomendacaoProduto[] }) {
  return (
    <ul data-testid="produtos-sugeridos" className="flex flex-col gap-2">
      {recomendacoes.map((r) => (
        <li
          key={r.necessidade}
          className={cn("rounded-md border bg-background p-2.5", r.sensivel && "border-amber-300 bg-amber-50/70")}
        >
          {r.sensivel && (
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
              <HeartHandshake className="size-3.5" /> Momento delicado: acolha antes de ofertar
            </p>
          )}
          <div className="flex items-center gap-2 font-medium">
            {r.revisao ? <RefreshCw className="size-4 text-sky-600" /> : <ShieldCheck className="size-4 text-emerald-600" />}
            {r.produto}
            {r.revisao && <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[11px] font-medium text-sky-800">Já tem</span>}
          </div>
          {r.descricao && <p className="mt-0.5 text-xs text-muted-foreground">{r.descricao}</p>}
          {r.motivo && (
            <p data-testid="motivo" className="mt-1 text-xs text-slate-700">
              Por quê: “{r.motivo}”
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
