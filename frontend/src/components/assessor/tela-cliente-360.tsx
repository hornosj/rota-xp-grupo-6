"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, MessageSquareText } from "lucide-react";
import { IndicadorAoVivo } from "@/components/comum/indicador-ao-vivo";
import { ErroCarregar, Sobretitulo } from "@/components/comum/marcadores";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Id, Visao360 } from "@/lib/api-types";
import { useAoVivo } from "@/lib/ao-vivo";
import { useDemoEstado, useVisao360 } from "@/lib/queries";
import { CabecalhoCliente } from "./cabecalho-cliente";
import { CardBriefing } from "./card-briefing";
import { CardDesagio } from "./card-desagio";
import { CardFluxoCaixa } from "./card-fluxo-caixa";
import { CardPatrimonio } from "./card-patrimonio";
import { CardPrincipalidade } from "./card-principalidade";
import { CardRadarCliente } from "./card-radar-cliente";
import { DialogMensagem } from "./dialog-mensagem";
import { LinhaDoTempo } from "./linha-do-tempo";
import { ListaAcoes } from "./lista-acoes";
import { ListaAlertas, ordenarAlertas } from "./lista-alertas";

/** Bloco preto do topo: o motivo da ligação (alerta da ação principal), a sugestão e um gancho de relacionamento. */
function MotivoLigacao({ visao }: { visao: Visao360 }) {
  const [mensagem, setMensagem] = useState(false);
  const principal = visao.acoes.find((a) => a.principal) ?? visao.acoes[0];
  const alertas = ordenarAlertas(visao.alertas);
  const alerta = alertas.find((a) => principal?.alertaIds.includes(a.id)) ?? alertas[0];
  const gancho = alertas.find((a) => a.tipo === "EVENTO_VIDA_PROXIMO" && a.id !== alerta?.id);
  const manchete = alerta?.titulo ?? principal?.titulo;
  if (!manchete) return null;

  return (
    <section className="flex flex-wrap items-end justify-between gap-8 rounded-[28px] bg-black p-6 text-white sm:p-10">
      <div className="flex min-w-0 flex-[1_1_560px] flex-col gap-3.5">
        <Sobretitulo className="text-white/80">Motivo da ligação</Sobretitulo>
        <p className="text-3xl leading-tight font-extrabold tracking-tight sm:text-[42px]">{manchete}</p>
        {principal && principal.titulo !== manchete && (
          <p className="text-lg leading-relaxed text-white/90">
            Sugestão: {principal.titulo}.{principal.impactoEstimado && ` ${principal.impactoEstimado}.`}
          </p>
        )}
        {gancho && <p className="text-lg leading-relaxed text-white/90">Para abrir a conversa: {gancho.titulo}.</p>}
      </div>
      <div className="flex flex-wrap gap-3">
        {principal && (
          <Button variant="inverso" size="lg" onClick={() => setMensagem(true)}>
            <MessageSquareText /> Gerar mensagem
          </Button>
        )}
        <a href="#briefing" className={buttonVariants({ variant: "contorno-inverso", size: "lg" })}>
          Ir para o briefing
        </a>
      </div>
      {principal && mensagem && (
        <DialogMensagem
          clienteId={visao.cliente.id}
          nomeCliente={visao.cliente.nome}
          acao={principal}
          open={mensagem}
          onOpenChange={(o) => {
            if (!o) setMensagem(false);
          }}
        />
      )}
    </section>
  );
}

export function TelaCliente360({ clienteId }: { clienteId: Id }) {
  const aoVivo = useAoVivo();
  const visao = useVisao360(clienteId, { aoVivo });
  const demo = useDemoEstado();

  const voltar = (
    <Link
      href={`/assessor/hoje${aoVivo ? "?aoVivo=1" : ""}`}
      className="inline-flex min-h-10 items-center gap-2 text-base font-semibold hover:underline"
    >
      <ArrowLeft className="size-5" /> Fila de hoje
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
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {voltar}
        {aoVivo && <IndicadorAoVivo atualizando={visao.isFetching} />}
      </div>
      <CabecalhoCliente visao={v} aoVivo={aoVivo} />
      <MotivoLigacao visao={v} />

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>Alertas</CardTitle>
                {novos > 0 && (
                  <span className="rounded-full bg-black px-2.5 py-0.5 text-[13px] font-extrabold tracking-wide text-white uppercase">
                    {novos} {novos > 1 ? "novos" : "novo"}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ListaAlertas alertas={v.alertas} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Ações sugeridas</CardTitle>
            </CardHeader>
            <CardContent>
              <ListaAcoes clienteId={clienteId} nomeCliente={v.cliente.nome} acoes={v.acoes} />
            </CardContent>
          </Card>
          <CardRadarCliente clienteId={clienteId} aoVivo={aoVivo} />
          <CardPrincipalidade principalidade={v.principalidade} />
          <CardDesagio clienteId={clienteId} />
        </div>
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-6">
          <CardPatrimonio patrimonio={v.patrimonio} cobertura={v.cobertura} />
          <CardFluxoCaixa fluxo={v.fluxoCaixa} />
          <Card>
            <CardHeader>
              <CardTitle>Eventos de vida</CardTitle>
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
    <div className="flex flex-col gap-6" aria-label="Carregando">
      <Skeleton className="h-28 w-full rounded-3xl" />
      <Skeleton className="h-56 w-full rounded-[28px]" />
      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-48 rounded-3xl" />
        </div>
        <div className="flex flex-col gap-6">
          <Skeleton className="h-56 rounded-3xl" />
          <Skeleton className="h-48 rounded-3xl" />
        </div>
      </div>
    </div>
  );
}
