"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BadgePosicaoXp, ChipPerfil, TagNovo, Vazio } from "@/components/comum/marcadores";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ItemFila } from "@/lib/api-types";
import { numero } from "@/lib/formato";
import { cn } from "@/lib/utils";

function corPrioridade(p: number) {
  if (p >= 70) return "bg-slate-900";
  if (p >= 35) return "bg-slate-600";
  return "bg-slate-400";
}

export function ListaFila({ itens, sufixoLink = "" }: { itens: ItemFila[]; sufixoLink?: string }) {
  if (!itens.length) return <Vazio>Nenhum cliente na fila hoje. Bom trabalho!</Vazio>;
  return (
    <ol className="flex flex-col gap-3">
      {itens.map((item) => (
        <li
          key={item.clienteId}
          data-testid="item-fila"
          className={cn(
            "group relative rounded-xl border bg-card p-4 shadow-xs transition-all duration-500 hover:border-slate-400",
            item.novo && "animate-entrada border-blue-300 ring-2 ring-blue-200",
          )}
        >
          <div className="flex items-start gap-4">
            <div
              data-testid="posicao"
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-full text-lg font-bold tabular-nums",
                item.posicao === 1 ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700",
              )}
            >
              {item.posicao}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/assessor/clientes/${item.clienteId}${sufixoLink}`}
                  className="text-lg font-semibold after:absolute after:inset-0 hover:underline"
                >
                  {item.nome}
                </Link>
                <ChipPerfil perfil={item.perfil} />
                <BadgePosicaoXp posicao={item.posicaoXp} />
                {item.novo && <TagNovo />}
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                  <div
                    className={cn("h-full rounded-full transition-all duration-700", corPrioridade(item.prioridade))}
                    style={{ width: `${Math.max(0, Math.min(100, item.prioridade))}%` }}
                  />
                </div>
                <span className="w-24 text-right text-sm text-muted-foreground">
                  <span className="text-xl font-bold text-foreground tabular-nums">{numero(item.prioridade)}</span> pts
                </span>
              </div>
              {item.motivos.length > 0 && (
                <div className="relative z-10 mt-2 flex flex-wrap gap-1.5">
                  {item.motivos.map((m) => (
                    <Tooltip key={m.texto}>
                      <TooltipTrigger
                        render={<span />}
                        className="cursor-default rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                      >
                        {m.texto}
                      </TooltipTrigger>
                      <TooltipContent>+{numero(m.pontos)} pontos de prioridade</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              )}
              {item.acaoPrincipal && (
                <p className="mt-2 text-sm">
                  <span className="text-muted-foreground">Próxima ação: </span>
                  <span className="font-medium">{item.acaoPrincipal.titulo}</span>
                </p>
              )}
            </div>
            <ChevronRight className="mt-3 size-5 shrink-0 text-slate-300 group-hover:text-slate-600" />
          </div>
        </li>
      ))}
    </ol>
  );
}
