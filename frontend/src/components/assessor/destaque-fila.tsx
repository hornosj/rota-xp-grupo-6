"use client";

import Link from "next/link";
import { useState } from "react";
import { MessageSquareText } from "lucide-react";
import { BadgePosicaoXp, ChipPerfil, Sobretitulo, TagNovo } from "@/components/comum/marcadores";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ItemFila } from "@/lib/api-types";
import { numero } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { DialogMensagem } from "./dialog-mensagem";

/** O 1º da fila em destaque: motivo mais forte, próxima ação e por que ligar, ponto a ponto. */
export function DestaqueFila({ item, sufixoLink = "" }: { item: ItemFila; sufixoLink?: string }) {
  const [mensagem, setMensagem] = useState(false);
  const [motivo] = item.motivos;
  const maior = Math.max(1, ...item.motivos.map((m) => m.pontos));
  const acao = item.acaoPrincipal;

  return (
    <section
      data-testid="item-fila"
      aria-label={`${item.posicao}º da fila: ${item.nome}`}
      className={cn("flex flex-wrap gap-10 rounded-[28px] bg-black p-6 text-white sm:p-10", item.novo && "animate-entrada")}
    >
      <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-6">
        {item.novo && <TagNovo className="self-start bg-white text-black" />}
        <div className="flex flex-wrap items-end gap-5">
          <span data-testid="posicao" className="text-8xl leading-[0.8] font-extrabold tracking-tighter sm:text-[112px]">
            {item.posicao}º
          </span>
          <div className="flex flex-col gap-2.5">
            <Link
              href={`/assessor/clientes/${item.clienteId}${sufixoLink}`}
              className="text-3xl font-extrabold tracking-tight hover:underline"
            >
              {item.nome}
            </Link>
            <div className="flex flex-wrap gap-2">
              <ChipPerfil perfil={item.perfil} className="ring-white" />
              <BadgePosicaoXp posicao={item.posicaoXp} className="ring-white" />
            </div>
          </div>
        </div>
        {motivo && <p className="text-3xl leading-tight font-extrabold tracking-tight sm:text-[40px]">{motivo.texto}</p>}
        {acao && (
          <div className="flex flex-col gap-1.5 border-t border-white/40 pt-5">
            <Sobretitulo className="text-white/80">Próxima melhor ação</Sobretitulo>
            <p className="text-xl leading-snug font-bold">{acao.titulo}</p>
            {acao.impactoEstimado && <p className="text-[17px] text-white/90">Resultado: {acao.impactoEstimado}</p>}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          {acao && (
            <Button variant="inverso" size="lg" onClick={() => setMensagem(true)}>
              <MessageSquareText /> Gerar mensagem
            </Button>
          )}
          <Link
            href={`/assessor/clientes/${item.clienteId}${sufixoLink}`}
            className={buttonVariants({ variant: "contorno-inverso", size: "lg" })}
          >
            Abrir visão 360
          </Link>
        </div>
      </div>

      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4 self-start rounded-2xl bg-white p-6 text-black">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-lg font-extrabold">Por que ligar</h3>
          <p>
            <span className="text-4xl font-extrabold tracking-tight">{numero(item.prioridade)}</span>
            <span className="text-base text-muted-foreground"> pts</span>
          </p>
        </div>
        <ul className="flex flex-col gap-3.5">
          {item.motivos.map((m) => (
            <li key={m.texto} className="flex flex-col gap-1.5">
              <div className="flex justify-between gap-3 text-base leading-snug">
                <span>{m.texto}</span>
                <span className="shrink-0 font-extrabold">+{numero(m.pontos)}</span>
              </div>
              <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-[#e6e6e6]">
                <span className="block h-full bg-black" style={{ width: `${(m.pontos / maior) * 100}%` }} />
              </span>
            </li>
          ))}
        </ul>
        <p className="border-t pt-2.5 text-sm text-muted-foreground">Soma limitada a 100 pontos.</p>
      </div>

      {acao && mensagem && (
        <DialogMensagem
          clienteId={item.clienteId}
          nomeCliente={item.nome}
          acao={acao}
          open={mensagem}
          onOpenChange={(o) => {
            if (!o) setMensagem(false);
          }}
        />
      )}
    </section>
  );
}
