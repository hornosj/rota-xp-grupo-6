"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Building2, CalendarClock, CheckCircle2, Eye, Loader2, Lock, ShieldCheck, Trophy, Undo2 } from "lucide-react";
import { ErroCarregar } from "@/components/comum/marcadores";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Diagnostico, Id, Jornada } from "@/lib/api-types";
import { useConceder, useConsentimentos, useJornada } from "@/lib/queries";
import { descricaoEscopo, rotuloEscopo } from "@/lib/rotulos";
import { cn } from "@/lib/utils";
import { Confete } from "./confete";
import { CorpoFgc } from "./detalhe-diagnostico";

const PRAZO_MESES = 12;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

function Passos({ atual }: { atual: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-1 gap-1.5">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={cn("h-1.5 flex-1 rounded-full", n <= atual ? "bg-slate-900" : "bg-slate-200")} />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">Passo {atual} de 4</span>
    </div>
  );
}

function recemDesbloqueados(antes: Jornada | null, depois: Jornada | undefined): Diagnostico[] {
  if (!depois) return [];
  const jaAbertos = new Set(antes?.diagnosticos.filter((d) => d.desbloqueado).map((d) => d.tipo) ?? []);
  return depois.diagnosticos.filter((d) => d.desbloqueado && !jaAbertos.has(d.tipo));
}

export function FluxoConectar({
  clienteId,
  instituicaoId,
  atrasoMs = 1500,
}: {
  clienteId: Id;
  instituicaoId: Id;
  atrasoMs?: number;
}) {
  const consentimentos = useConsentimentos(clienteId);
  const jornada = useJornada(clienteId);
  const conceder = useConceder();
  const [passo, setPasso] = useState(1);
  const [fase, setFase] = useState<"conectando" | "sucesso" | "erro">("conectando");
  const [jornadaAntes, setJornadaAntes] = useState<Jornada | null>(null);

  if (consentimentos.isError) return <ErroCarregar erro={consentimentos.error} className="m-4" />;
  if (!consentimentos.data) {
    return (
      <div className="flex flex-col gap-4 p-4" aria-label="Carregando">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-11 w-full" />
      </div>
    );
  }

  const consentimento = consentimentos.data.find((c) => c.instituicaoId === instituicaoId);
  const voltar = `/cliente/${clienteId}`;
  if (!consentimento) {
    return (
      <div className="p-4">
        <ErroCarregar erro={new Error("Esta instituição não está entre as que você declarou.")} />
        <Link href={voltar} className={cn(buttonVariants({ variant: "outline" }), "mt-4 w-full")}>
          Voltar
        </Link>
      </div>
    );
  }
  const nome = consentimento.instituicaoNome;

  // Já ativo antes de começar o fluxo → só avisa (depois de concluir, o passo é 4).
  if (consentimento.status === "ATIVO" && passo === 1) {
    return (
      <div className="flex flex-col gap-4 p-4 pt-8 text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
        <p className="text-lg font-semibold">O {nome} já está conectado.</p>
        <Link href={voltar} className={cn(buttonVariants({ size: "lg" }), "h-11")}>
          Voltar para a jornada
        </Link>
      </div>
    );
  }

  async function confirmar() {
    setJornadaAntes(jornada.data ?? null);
    setPasso(4);
    setFase("conectando");
    try {
      await Promise.all([conceder.mutateAsync({ clienteId, instituicaoId }), esperar(atrasoMs)]);
      await jornada.refetch();
      setFase("sucesso");
    } catch {
      setFase("erro");
    }
  }

  return (
    <div className="relative flex min-h-full flex-col gap-5 p-4 pt-5">
      <div className="flex items-center gap-2">
        {passo < 4 ? (
          passo === 1 ? (
            <Link href={voltar} aria-label="Voltar" className="rounded-full p-1 hover:bg-slate-100">
              <ArrowLeft className="size-5" />
            </Link>
          ) : (
            <button type="button" aria-label="Voltar" onClick={() => setPasso(passo - 1)} className="rounded-full p-1 hover:bg-slate-100">
              <ArrowLeft className="size-5" />
            </button>
          )
        ) : null}
        <p className="font-semibold">Conectar {nome}</p>
      </div>
      <Passos atual={passo} />

      {passo === 1 && (
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl leading-tight font-bold">Traga o {nome} para a sua visão completa</h1>
          <ul className="flex flex-col gap-3">
            <li className="flex gap-3 rounded-xl bg-slate-50 p-3">
              <Eye className="mt-0.5 size-5 shrink-0" />
              <span className="text-sm">
                <span className="font-semibold">O que vamos ver:</span> só os dados que você autorizar, como{" "}
                {consentimento.escopos.map((e) => descricaoEscopo[e]).join(", ")}.
              </span>
            </li>
            <li className="flex gap-3 rounded-xl bg-slate-50 p-3">
              <CalendarClock className="mt-0.5 size-5 shrink-0" />
              <span className="text-sm">
                <span className="font-semibold">Por quanto tempo:</span> {PRAZO_MESES} meses.
              </span>
            </li>
            <li className="flex gap-3 rounded-xl bg-slate-50 p-3">
              <Undo2 className="mt-0.5 size-5 shrink-0" />
              <span className="text-sm">
                <span className="font-semibold">Você no controle:</span> dá para revogar a qualquer momento, aqui no app.
              </span>
            </li>
          </ul>
          <p className="text-xs text-muted-foreground">
            Compartilhamento pelo Open Finance, regulado pelo Banco Central. Nada de senha: você confirma no próprio banco.
          </p>
          <Button size="lg" className="h-12 text-base" onClick={() => setPasso(2)}>
            Começar
          </Button>
        </div>
      )}

      {passo === 2 && (
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl leading-tight font-bold">O que você vai compartilhar</h1>
          <ul className="flex flex-col gap-2">
            {consentimento.escopos.map((e) => (
              <li key={e} className="flex items-center gap-3 rounded-xl border p-3">
                <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-semibold">{rotuloEscopo[e]}</p>
                  <p className="text-xs text-muted-foreground">{descricaoEscopo[e]}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm">
            <CalendarClock className="size-5 shrink-0" />
            <span>
              Prazo: <span className="font-semibold">{PRAZO_MESES} meses</span>. Você pode revogar antes.
            </span>
          </div>
          <Button size="lg" className="h-12 text-base" onClick={() => setPasso(3)}>
            Continuar para o {nome}
          </Button>
        </div>
      )}

      {passo === 3 && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-dashed border-amber-400 bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-900">
            Simulação para a demo · banco fictício · nenhum dado real é acessado
          </div>
          <div className="overflow-hidden rounded-2xl border shadow-sm">
            <div className="flex items-center gap-2 bg-indigo-900 px-4 py-3 text-white">
              <Building2 className="size-5" />
              <span className="font-semibold">{nome}</span>
              <span className="ml-auto rounded bg-white/15 px-1.5 py-0.5 text-[10px] uppercase">simulação</span>
            </div>
            <div className="flex flex-col gap-3 p-4">
              <p className="text-lg font-semibold">Você está no ambiente do {nome}</p>
              <p className="text-sm text-slate-600">
                A XP Investimentos pede acesso, por {PRAZO_MESES} meses, a:
              </p>
              <ul className="text-sm">
                {consentimento.escopos.map((e) => (
                  <li key={e} className="flex items-center gap-2">
                    <Lock className="size-3.5 text-slate-500" /> {rotuloEscopo[e]}
                  </li>
                ))}
              </ul>
              <Button size="lg" className="h-12 bg-indigo-900 text-base hover:bg-indigo-800" onClick={confirmar}>
                Confirmar compartilhamento
              </Button>
            </div>
          </div>
        </div>
      )}

      {passo === 4 && fase === "conectando" && (
        <div className="flex flex-col items-center gap-3 py-16 text-center" role="status">
          <Loader2 className="size-10 animate-spin text-slate-700" />
          <p className="font-semibold">Conectando o {nome}…</p>
          <p className="text-sm text-muted-foreground">Buscando seus dados com segurança</p>
        </div>
      )}

      {passo === 4 && fase === "erro" && (
        <div className="flex flex-col gap-3">
          <ErroCarregar erro={conceder.error ?? new Error("Falha ao conectar")} />
          <Button onClick={confirmar}>Tentar de novo</Button>
        </div>
      )}

      {passo === 4 && fase === "sucesso" && <Sucesso clienteId={clienteId} nome={nome} antes={jornadaAntes} depois={jornada.data} />}
    </div>
  );
}

function Sucesso({ clienteId, nome, antes, depois }: { clienteId: Id; nome: string; antes: Jornada | null; depois?: Jornada }) {
  const novos = recemDesbloqueados(antes, depois);
  const fgc = novos.find((d) => d.tipo === "PROTECAO_FGC");
  const outros = novos.filter((d) => d !== fgc);
  const subiu = !!depois && (!antes || depois.nivel.numero > antes.nivel.numero);
  return (
    <div className="flex flex-col gap-4">
      <Confete />
      <div className="animate-desbloqueio flex flex-col items-center gap-2 pt-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100">
          <ShieldCheck className="size-9 text-emerald-600" />
        </div>
        <p className="text-2xl font-bold">{nome} conectado!</p>
        {depois && (
          <p className="text-sm text-muted-foreground">Seu patrimônio agora está {Math.round(depois.completude * 100)}% visível</p>
        )}
      </div>
      {subiu && depois && (
        <div className="animate-subida-nivel flex items-center gap-3 rounded-2xl bg-emerald-600 p-4 text-white">
          <Trophy className="size-7 shrink-0" />
          <div>
            <p className="text-xs tracking-wide uppercase opacity-80">Subiu de nível</p>
            <p className="text-lg font-bold">
              Nível {depois.nivel.numero}: {depois.nivel.nome}
            </p>
          </div>
        </div>
      )}
      {fgc && (
        <div className="animate-desbloqueio flex flex-col gap-2 rounded-2xl border border-emerald-200 p-4 [animation-delay:300ms]">
          <p className="font-semibold">Diagnóstico desbloqueado: {fgc.titulo}</p>
          <CorpoFgc d={fgc} />
        </div>
      )}
      {outros.map((d) => (
        <p key={d.tipo} className="rounded-xl bg-slate-50 p-3 text-sm">
          <span className="font-semibold">Diagnóstico desbloqueado: {d.titulo}</span>
          {d.resumo && <span className="text-muted-foreground"> · {d.resumo}</span>}
        </p>
      ))}
      <Link href={`/cliente/${clienteId}`} className={cn(buttonVariants({ size: "lg" }), "h-12 text-base")}>
        Ver minha jornada
      </Link>
    </div>
  );
}
