"use client";

import { useState } from "react";
import { MessageSquareText, Star } from "lucide-react";
import { Vazio } from "@/components/comum/marcadores";
import { Button } from "@/components/ui/button";
import type { AcaoSugerida, Id } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { DialogMensagem } from "./dialog-mensagem";

export function ListaAcoes({ clienteId, acoes }: { clienteId: Id; acoes: AcaoSugerida[] }) {
  const [aberta, setAberta] = useState<AcaoSugerida | null>(null);
  if (!acoes.length) return <Vazio>Nenhuma ação sugerida no momento.</Vazio>;
  const ordenadas = [...acoes].sort((a, b) => Number(b.principal) - Number(a.principal));
  return (
    <>
      <ul className="flex flex-col gap-2">
        {ordenadas.map((a) => (
          <li
            key={a.id}
            data-testid="acao"
            className={cn("rounded-lg border p-3", a.principal && "border-slate-900 bg-slate-50 ring-1 ring-slate-900")}
          >
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {a.principal && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
                      <Star className="size-3" /> Principal
                    </span>
                  )}
                  <span className="font-semibold">{a.titulo}</span>
                </div>
                <p className="mt-1 text-sm text-slate-700">{a.motivo}</p>
                {a.impactoEstimado && <p className="mt-1 text-sm font-medium text-emerald-700">{a.impactoEstimado}</p>}
              </div>
              <Button
                onClick={() => setAberta(a)}
                variant={a.principal ? "default" : "outline"}
                size="lg"
                className="shrink-0"
              >
                <MessageSquareText /> Gerar mensagem
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {aberta && (
        <DialogMensagem
          clienteId={clienteId}
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
