"use client";

import { Keyboard, Mic } from "lucide-react";
import { ErroCarregar, Vazio } from "@/components/comum/marcadores";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Id } from "@/lib/api-types";
import { data } from "@/lib/formato";
import { useContextoAssessor } from "@/lib/queries";
import { ListaProdutosSugeridos } from "./lista-produtos-sugeridos";

/** Notas do assessor ("nota de contexto") e os produtos que elas sugerem. */
export function CardContextoAssessor({ clienteId }: { clienteId: Id }) {
  const ctx = useContextoAssessor(clienteId);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contexto do assessor</CardTitle>
      </CardHeader>
      <CardContent>
        {ctx.isPending && <Skeleton className="h-16 w-full" />}
        {ctx.isError && <ErroCarregar erro={ctx.error} />}
        {ctx.data && ctx.data.anotacoes.length === 0 && (
          <Vazio>Nenhuma nota ainda. Use “Nota de contexto” para gravar um áudio ou escrever o que mudou na vida do cliente.</Vazio>
        )}
        {ctx.data && ctx.data.anotacoes.length > 0 && (
          <div className="flex flex-col gap-4 text-sm">
            {ctx.data.recomendacoes.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase">Produtos para oferecer</p>
                <ListaProdutosSugeridos recomendacoes={ctx.data.recomendacoes} />
              </div>
            )}
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase">Notas</p>
              <ul className="flex flex-col gap-2">
                {ctx.data.anotacoes.map((a) => (
                  <li key={a.id} data-testid="anotacao" className="border-l-2 pl-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {a.origem === "AUDIO" ? (
                        <span role="img" aria-label="Nota de áudio">
                          <Mic className="size-3.5" />
                        </span>
                      ) : (
                        <span role="img" aria-label="Nota digitada">
                          <Keyboard className="size-3.5" />
                        </span>
                      )}
                      {data(a.data)}
                    </div>
                    <p>{a.texto}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
