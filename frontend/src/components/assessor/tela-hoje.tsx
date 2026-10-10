"use client";

import { IndicadorAoVivo } from "@/components/comum/indicador-ao-vivo";
import { ErroCarregar } from "@/components/comum/marcadores";
import { Skeleton } from "@/components/ui/skeleton";
import { useAoVivo } from "@/lib/ao-vivo";
import { useFila } from "@/lib/queries";
import { ListaFila } from "./lista-fila";

export function TelaHoje() {
  const aoVivo = useAoVivo();
  const fila = useFila({ aoVivo });
  const comMotivo = fila.data?.filter((i) => i.prioridade > 0).length ?? 0;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hoje</h1>
          <p className="text-muted-foreground">
            Motivos para ligar, em ordem de prioridade
            {fila.data && ` · ${comMotivo} cliente${comMotivo === 1 ? "" : "s"} com motivo`}
          </p>
        </div>
        {aoVivo && <IndicadorAoVivo atualizando={fila.isFetching} />}
      </div>
      {fila.isError && <ErroCarregar erro={fila.error} />}
      {!fila.data && !fila.isError && <EsqueletoFila />}
      {fila.data && <ListaFila itens={fila.data} sufixoLink={aoVivo ? "?aoVivo=1" : ""} />}
    </div>
  );
}

export function EsqueletoFila() {
  return (
    <div className="flex flex-col gap-3" aria-label="Carregando">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-xl" />
      ))}
    </div>
  );
}
