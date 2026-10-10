import Link from "next/link";
import { CheckCircle2, Gift, Target } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { Id, Missao } from "@/lib/api-types";
import { cn } from "@/lib/utils";

export function CardMissao({ clienteId, missao }: { clienteId: Id; missao: Missao }) {
  const concluida = missao.status === "CONCLUIDA";
  const conecta = missao.tipo === "CONECTAR_INSTITUICAO" || missao.tipo === "CONECTAR_CARTAO" || missao.tipo === "RENOVAR_CONSENTIMENTO";
  return (
    <div className={cn("rounded-2xl border p-4", concluida ? "border-emerald-200 bg-emerald-50/60" : "bg-card")}>
      <div className="flex items-start gap-3">
        {concluida ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
        ) : (
          <Target className="mt-0.5 size-5 shrink-0 text-slate-700" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{missao.titulo}</p>
          <p className="mt-0.5 text-sm text-slate-600">{missao.descricao}</p>
          <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            <Gift className="size-3.5" /> {missao.recompensa}
          </p>
          {!concluida && missao.progresso > 0 && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-slate-900" style={{ width: `${Math.round(missao.progresso * 100)}%` }} />
            </div>
          )}
        </div>
      </div>
      {concluida ? (
        <p className="mt-3 text-sm font-semibold text-emerald-700">Concluída</p>
      ) : (
        conecta &&
        missao.instituicaoId && (
          <Link
            href={`/cliente/${clienteId}/conectar/${missao.instituicaoId}`}
            className={cn(buttonVariants({ size: "lg" }), "mt-3 h-11 w-full text-base")}
          >
            {missao.tipo === "RENOVAR_CONSENTIMENTO" ? "Renovar conexão" : "Conectar agora"}
          </Link>
        )
      )}
    </div>
  );
}
