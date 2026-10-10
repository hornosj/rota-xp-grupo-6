"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BadgePosicaoXp, TagNovo, Vazio } from "@/components/comum/marcadores";
import type { ItemFila } from "@/lib/api-types";
import { numero } from "@/lib/formato";
import { cn } from "@/lib/utils";

const largura = (p: number) => `${Math.max(0, Math.min(100, p))}%`;

/** Linhas da fila: posição, cliente, motivo mais forte, próxima ação e prioridade. */
export function ListaFila({ itens, sufixoLink = "" }: { itens: ItemFila[]; sufixoLink?: string }) {
  if (!itens.length) return <Vazio>Nenhum cliente na fila hoje. Bom trabalho!</Vazio>;
  return (
    <ol className="border-t-2 border-black">
      {itens.map((item) => {
        const [motivo, ...outros] = item.motivos;
        return (
          <li
            key={item.clienteId}
            data-testid="item-fila"
            className={cn("group relative border-b transition-colors hover:bg-muted/60", item.novo && "animate-entrada")}
          >
            <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 px-1 py-6 sm:grid-cols-[5rem_minmax(0,1fr)_9rem_1.5rem] sm:gap-x-5 sm:px-2">
              <span data-testid="posicao" className="text-3xl font-extrabold tracking-tight sm:text-[40px]">
                {item.posicao}º
              </span>
              <div className="flex min-w-0 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Link
                    href={`/assessor/clientes/${item.clienteId}${sufixoLink}`}
                    className="text-xl font-bold after:absolute after:inset-0 group-hover:underline"
                  >
                    {item.nome}
                  </Link>
                  <BadgePosicaoXp posicao={item.posicaoXp} />
                  {item.novo && <TagNovo />}
                </div>
                {motivo && (
                  <p className="text-[17px] text-[#333]">
                    {motivo.texto}
                    {outros.length > 0 && (
                      <span className="text-muted-foreground">
                        {" "}
                        · e mais {outros.length} {outros.length === 1 ? "motivo" : "motivos"}
                      </span>
                    )}
                  </p>
                )}
                {item.acaoPrincipal && (
                  <p className="text-[15px]">
                    <span className="text-muted-foreground">Próxima ação: </span>
                    <span className="font-semibold">{item.acaoPrincipal.titulo}</span>
                  </p>
                )}
              </div>
              <div className="col-start-2 flex items-center gap-3 sm:col-start-auto sm:flex-col sm:items-end sm:gap-2">
                <span className="text-2xl font-extrabold">
                  {numero(item.prioridade)}
                  <span className="sr-only"> pontos de prioridade</span>
                </span>
                <span aria-hidden className="h-1.5 w-32 overflow-hidden rounded-full bg-[#e6e6e6]">
                  <span className="block h-full bg-black transition-all duration-700" style={{ width: largura(item.prioridade) }} />
                </span>
              </div>
              <ChevronRight aria-hidden className="hidden size-6 sm:block" />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
