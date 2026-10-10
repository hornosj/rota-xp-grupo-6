"use client";

import Link from "next/link";
import { useState } from "react";
import { PartyPopper, ShieldCheck } from "lucide-react";
import { ErroCarregar, Vazio } from "@/components/comum/marcadores";
import { Skeleton } from "@/components/ui/skeleton";
import type { Diagnostico, Id } from "@/lib/api-types";
import { primeiroNome } from "@/lib/formato";
import { useJornada, useVisao360 } from "@/lib/queries";
import { AnelCompletude } from "./anel-completude";
import { CardDiagnostico } from "./card-diagnostico";
import { CardMissao } from "./card-missao";
import { ChipNivel } from "./chip-nivel";
import { DetalheDiagnostico } from "./detalhe-diagnostico";

export function JornadaCliente({ clienteId, aoVivo }: { clienteId: Id; aoVivo?: boolean }) {
  const jornada = useJornada(clienteId, { aoVivo });
  const visao = useVisao360(clienteId, { aoVivo });
  const [aberto, setAberto] = useState<Diagnostico | null>(null);

  // Detecta subida de nível entre atualizações (animação curta).
  const numeroNivel = jornada.data?.nivel.numero;
  const [nivelAnterior, setNivelAnterior] = useState(numeroNivel);
  const [subiu, setSubiu] = useState(false);
  if (numeroNivel !== nivelAnterior) {
    setSubiu(nivelAnterior != null && numeroNivel != null && numeroNivel > nivelAnterior);
    setNivelAnterior(numeroNivel);
  }

  if (jornada.isError) return <ErroCarregar erro={jornada.error} className="m-4" />;
  if (!jornada.data) return <EsqueletoJornada />;

  const j = jornada.data;
  const nome = visao.data ? primeiroNome(visao.data.cliente.nome) : null;
  const disponiveis = j.missoes.filter((m) => m.status === "DISPONIVEL");
  const concluidas = j.missoes.filter((m) => m.status === "CONCLUIDA");

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-10">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Sua jornada financeira</p>
          <h1 className="text-2xl font-bold">{nome ? `Olá, ${nome}!` : "Olá!"}</h1>
        </div>
        <Link
          href={`/cliente/${clienteId}/consentimentos`}
          className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
        >
          <ShieldCheck className="size-3.5" /> Meus dados
        </Link>
      </header>

      {subiu && (
        <div className="animate-subida-nivel flex items-center gap-3 rounded-2xl bg-emerald-600 p-4 text-white">
          <PartyPopper className="size-6" />
          <p className="font-semibold">Você subiu para o nível {j.nivel.numero}: {j.nivel.nome}!</p>
        </div>
      )}

      <AnelCompletude completude={j.completude} />
      <ChipNivel nivel={j.nivel} />

      <section>
        <h2 className="mb-2 text-base font-semibold">Missões</h2>
        {j.missoes.length === 0 ? (
          <Vazio>Nenhuma missão no momento.</Vazio>
        ) : (
          <div className="flex flex-col gap-3">
            {[...disponiveis, ...concluidas].map((m) => (
              <CardMissao key={m.id} clienteId={clienteId} missao={m} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold">Diagnósticos</h2>
        {j.diagnosticos.length === 0 ? (
          <Vazio>Nenhum diagnóstico disponível.</Vazio>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {j.diagnosticos.map((d) => (
              <CardDiagnostico key={d.tipo} diagnostico={d} onAbrir={setAberto} />
            ))}
          </div>
        )}
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Você escolhe o que compartilhar e pode revogar a qualquer momento.{" "}
        <Link href={`/cliente/${clienteId}/consentimentos`} className="underline">
          Gerenciar consentimentos
        </Link>
      </p>

      <DetalheDiagnostico diagnostico={aberto} onFechar={() => setAberto(null)} />
    </div>
  );
}

export function EsqueletoJornada() {
  return (
    <div className="flex flex-col gap-5 px-4 pt-6" aria-label="Carregando">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="mx-auto size-40 rounded-full" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
    </div>
  );
}
