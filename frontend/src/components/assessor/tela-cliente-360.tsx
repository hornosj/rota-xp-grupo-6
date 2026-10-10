"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { IndicadorAoVivo } from "@/components/comum/indicador-ao-vivo";
import { ErroCarregar } from "@/components/comum/marcadores";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Id } from "@/lib/api-types";
import { useAoVivo } from "@/lib/ao-vivo";
import { useDemoEstado, useVisao360 } from "@/lib/queries";
import { CabecalhoCliente } from "./cabecalho-cliente";
import { CardBriefing } from "./card-briefing";
import { CardFluxoCaixa } from "./card-fluxo-caixa";
import { CardPatrimonio } from "./card-patrimonio";
import { CardPrincipalidade } from "./card-principalidade";
import { LinhaDoTempo } from "./linha-do-tempo";
import { ListaAcoes } from "./lista-acoes";
import { ListaAlertas } from "./lista-alertas";

export function TelaCliente360({ clienteId }: { clienteId: Id }) {
  const aoVivo = useAoVivo();
  const visao = useVisao360(clienteId, { aoVivo });
  const demo = useDemoEstado();

  const voltar = (
    <Link
      href={`/assessor/hoje${aoVivo ? "?aoVivo=1" : ""}`}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> Fila de hoje
    </Link>
  );

  if (visao.isError) {
    return (
      <div className="flex flex-col gap-4">
        {voltar}
        <ErroCarregar erro={visao.error} />
      </div>
    );
  }
  if (!visao.data) return <Esqueleto360 />;
  const v = visao.data;
  const novos = v.alertas.filter((a) => a.novo).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        {voltar}
        {aoVivo && <IndicadorAoVivo atualizando={visao.isFetching} />}
      </div>
      <CabecalhoCliente visao={v} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Alertas
                {novos > 0 && <span className="ml-2 text-sm font-normal text-blue-700">{novos} novo{novos > 1 ? "s" : ""}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ListaAlertas alertas={v.alertas} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ações sugeridas</CardTitle>
            </CardHeader>
            <CardContent>
              <ListaAcoes clienteId={clienteId} acoes={v.acoes} />
            </CardContent>
          </Card>
          <CardPrincipalidade principalidade={v.principalidade} />
        </div>
        <div className="flex flex-col gap-5">
          <CardPatrimonio patrimonio={v.patrimonio} cobertura={v.cobertura} />
          <CardFluxoCaixa fluxo={v.fluxoCaixa} />
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Eventos de vida</CardTitle>
            </CardHeader>
            <CardContent>
              <LinhaDoTempo cliente={v.cliente} dataReferencia={demo.data?.dataReferencia} />
            </CardContent>
          </Card>
          <CardBriefing clienteId={clienteId} />
        </div>
      </div>
    </div>
  );
}

export function Esqueleto360() {
  return (
    <div className="flex flex-col gap-5" aria-label="Carregando">
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="grid gap-5 xl:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-5">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
