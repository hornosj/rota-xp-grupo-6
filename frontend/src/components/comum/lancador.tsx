"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { BotaoNotificacoes } from "@/components/assessor/botao-notificacoes";
import { CabecalhoApp } from "@/components/comum/cabecalho-app";
import { Sobretitulo, TagNovo } from "@/components/comum/marcadores";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { USE_MOCKS } from "@/lib/config";
import { brlCurto, numero, pct } from "@/lib/formato";
import { useFila, usePainel } from "@/lib/queries";
import { cn } from "@/lib/utils";

const ANCORAS = [
  { id: "cli-001", nome: "Dra. Marina Costa", caso: "Estrela da demo: Aurora é principal; Horizonte oculto acima do FGC" },
  { id: "cli-002", nome: "Carlos Andrade", caso: "XP principal; CDB vencendo e consentimento expirando" },
  { id: "cli-003", nome: "Juliana Prado", caso: "Saldo parado, reserva curta, cartão não conectado" },
  { id: "cli-004", nome: "Patrícia Gomes", caso: "FGC por conglomerado (Aurora + Aurora Financeira)" },
  { id: "cli-005", nome: "Roberto Lima", caso: "Exposição sem garantia alta (CRA Agro Sul)" },
  { id: "cli-006", nome: "Lucas Ferreira", caso: "Caso controle: XP principal, sem alertas" },
];

/** Prévia da fila: quem ligar primeiro e os três seguintes. */
function PreviaFila() {
  const fila = useFila();
  if (fila.isError) return null;
  const [primeiro, ...resto] = fila.data ?? [];
  return (
    <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-5 rounded-3xl bg-black p-6 text-white sm:p-8">
      <div className="flex items-center justify-between">
        <Sobretitulo className="text-white/80">Ligue primeiro</Sobretitulo>
        {primeiro?.novo && <TagNovo className="bg-white text-black" />}
      </div>
      {!primeiro ? (
        <Skeleton className="h-16 bg-white/15" />
      ) : (
        <Link href={`/assessor/clientes/${primeiro.clienteId}`} className="flex items-baseline gap-4 hover:underline">
          <span className="text-6xl leading-none font-extrabold tracking-tight">1º</span>
          <span className="flex flex-col gap-1.5">
            <span className="text-2xl font-bold">{primeiro.nome}</span>
            {primeiro.motivos[0] && <span className="text-[17px] text-white/90">{primeiro.motivos[0].texto}</span>}
          </span>
        </Link>
      )}
      <div className="h-px bg-white/30" />
      <ol className="flex flex-col gap-2.5 text-[17px]">
        {resto.slice(0, 3).map((i) => (
          <li key={i.clienteId} className="grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-3">
            <span className="font-extrabold">{i.posicao}º</span>
            <span>{i.nome}</span>
            <span className="text-white/80">{numero(i.prioridade)} pts</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Numeros() {
  const fila = useFila();
  const painel = usePainel();
  const p = painel.data;
  const comMotivo = fila.data?.filter((i) => i.prioridade > 0).length;
  const itens = [
    { valor: comMotivo != null ? String(comMotivo) : "—", rotulo: "clientes com motivo para ligar hoje" },
    { valor: p ? pct(p.pctClientesXpPrincipal) : "—", rotulo: "têm a XP como instituição principal" },
    { valor: p ? brlCurto(p.patrimonioForaXpVisivel) : "—", rotulo: "visíveis fora da XP pelo Open Finance" },
    { valor: p ? String(p.clientesComAlertaAlto) : "—", rotulo: "clientes com alerta alto" },
  ];
  return (
    <section aria-label="Números da carteira" className="grid border-t-2 border-b border-black sm:grid-cols-2 lg:grid-cols-4">
      {itens.map((n, i) => (
        <div key={n.rotulo} className={cn("flex flex-col gap-1.5 py-8 sm:px-6", i > 0 && "border-t sm:border-t-0 lg:border-l", i % 2 === 1 && "sm:border-l")}>
          <span className="text-5xl font-extrabold tracking-tight">{n.valor}</span>
          <span className="text-base text-muted-foreground">{n.rotulo}</span>
        </div>
      ))}
    </section>
  );
}

export function Lancador() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <CabecalhoApp />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-16 px-4 pt-14 pb-20 sm:px-8 sm:pt-18">
        <section className="flex flex-wrap items-center gap-12">
          <div className="flex min-w-0 flex-[1_1_560px] flex-col gap-7">
            <Sobretitulo>Hackathon XP · Grupo 6</Sobretitulo>
            <h1 className="text-5xl leading-none font-extrabold tracking-tight sm:text-7xl">
              Dados espalhados viram{" "}
              <span className="underline decoration-[6px] underline-offset-[10px]">motivos para ligar.</span>
            </h1>
            <p className="max-w-xl text-xl leading-relaxed text-muted-foreground">
              O Open Finance mostra onde a XP está na vida financeira de cada cliente. O Copiloto transforma isso numa fila do
              dia, com a mensagem pronta. Dados 100% fictícios.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/assessor/hoje" className={buttonVariants({ size: "lg" })}>
                Abrir a fila de hoje <ArrowRight />
              </Link>
              <Link href="/assessor" className={buttonVariants({ size: "lg", variant: "outline" })}>
                Ver meus clientes
              </Link>
            </div>
            <BotaoNotificacoes className="self-start" />
            {USE_MOCKS && (
              <p className="self-start rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-black">
                Modo mock ativo (NEXT_PUBLIC_USE_MOCKS=true)
              </p>
            )}
          </div>
          <PreviaFila />
        </section>

        <Numeros />

        <section className="flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-4xl font-extrabold tracking-tight">Clientes-âncora da demo</h2>
            <Link href="/assessor/convites" className="text-base font-bold underline underline-offset-4">
              Cadastrar um investidor novo
            </Link>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ANCORAS.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/assessor/clientes/${c.id}`}
                  className="flex h-full flex-col gap-2.5 rounded-3xl border p-6 transition hover:border-black"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-lg font-bold">{c.nome}</span>
                    <ArrowUpRight className="size-5 shrink-0" aria-hidden />
                  </span>
                  <span className="text-base leading-relaxed text-muted-foreground">{c.caso}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
