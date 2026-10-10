"use client";

import { useState } from "react";
import { MessageSquareText, Star } from "lucide-react";
import { Vazio } from "@/components/comum/marcadores";
import { Button } from "@/components/ui/button";
import type { AcaoSugerida, Id } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { DialogMensagem } from "./dialog-mensagem";

export function ListaAcoes({ clienteId, nomeCliente, acoes }: { clienteId: Id; nomeCliente?: string; acoes: AcaoSugerida[] }) {
  const [aberta, setAberta] = useState<AcaoSugerida | null>(null);
  if (!acoes.length) return <Vazio>Nenhuma ação sugerida no momento.</Vazio>;
  const ordenadas = [...acoes].sort((a, b) => Number(b.principal) - Number(a.principal));
  return (
    <>
      <ul className="flex flex-col gap-3">
        {ordenadas.map((a) => (
          <li
            key={a.id}
            data-testid="acao"
            className={cn("rounded-2xl p-5", a.principal ? "bg-black text-white" : "border")}
          >
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1.5">
                {a.principal && (
                  <span className="inline-flex items-center gap-1 self-start rounded-full bg-white px-2.5 py-0.5 text-[13px] font-extrabold text-black">
                    <Star className="size-3.5" /> Principal
                  </span>
                )}
                <span className="text-lg font-bold">{a.titulo}</span>
                <p className={cn("text-base leading-relaxed", a.principal ? "text-white/90" : "text-[#333]")}>{a.motivo}</p>
                {a.impactoEstimado && <p className="text-base font-semibold">Resultado: {a.impactoEstimado}</p>}
              </div>
              <Button onClick={() => setAberta(a)} variant={a.principal ? "inverso" : "outline"} className="shrink-0">
                <MessageSquareText /> Gerar mensagem
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {aberta && (
        <DialogMensagem
          clienteId={clienteId}
          nomeCliente={nomeCliente}
          acao={aberta}
          open={!!aberta}
          onOpenChange={(o) => {
            if (!o) setAberta(null);
          }}
        />
      )}
    </>
  );
}
