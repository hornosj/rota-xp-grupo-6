"use client";

import { CheckCircle2, Clock, FlaskConical, Loader2, Lock, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api-base";
import type { Convite } from "@/lib/api-types";
import { useConfirmarConvite, useConvite } from "@/lib/queries";
import { descricaoEscopo, rotuloEscopo } from "@/lib/rotulos";
import { cn } from "@/lib/utils";

/** Cores fictícias por banco (o logo é só as iniciais num círculo). */
const CORES: Record<string, string> = {
  "inst-horizonte": "bg-indigo-700",
  "inst-aurora": "bg-orange-600",
  "inst-ipe": "bg-yellow-500",
};

function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^[A-Z]/.test(p))
    .map((p) => p[0]?.toUpperCase())
    .join("")
    .slice(0, 2);
}

function LogoBanco({ convite, className }: { convite: Pick<Convite, "instituicaoId" | "instituicaoNome">; className?: string }) {
  return (
    <span
      data-testid="logo-banco"
      aria-hidden
      className={cn(
        "inline-flex size-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white",
        CORES[convite.instituicaoId] ?? "bg-slate-700",
        className,
      )}
    >
      {iniciais(convite.instituicaoNome)}
    </span>
  );
}

function AvisoSimulado() {
  return (
    <div className="flex items-center gap-2 bg-amber-100 px-4 py-2 text-xs font-medium text-amber-900">
      <FlaskConical className="size-4 shrink-0" />
      Ambiente simulado — demonstração. Nenhum banco real é acessado.
    </div>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen justify-center bg-slate-100">
      <div className="flex min-h-screen w-full max-w-[420px] flex-col bg-white shadow-sm">
        <AvisoSimulado />
        <div className="flex flex-1 flex-col px-5 pt-6 pb-8">{children}</div>
      </div>
    </div>
  );
}

function Mensagem({ icone, titulo, children }: { icone: React.ReactNode; titulo: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      {icone}
      <p className="text-xl font-bold">{titulo}</p>
      {children && <div className="text-sm text-slate-600">{children}</div>}
    </div>
  );
}

function Sucesso({ convite }: { convite: Convite }) {
  return (
    <Mensagem
      icone={<CheckCircle2 className="size-16 text-emerald-600" />}
      titulo={`Pronto! Sua assessora já consegue ver seus dados do ${convite.instituicaoNome}.`}
    >
      <p>O compartilhamento vale por {convite.prazoMeses} meses. Você pode revogar quando quiser.</p>
    </Mensagem>
  );
}

function Expirado() {
  return (
    <Mensagem icone={<Clock className="size-14 text-slate-500" />} titulo="Este convite expirou">
      <p>Por segurança, o link vale por 48 horas. Peça um novo link para sua assessora.</p>
    </Mensagem>
  );
}

export function TelaConvite({ token }: { token: string }) {
  const consulta = useConvite(token);
  const confirmar = useConfirmarConvite();

  if (consulta.isError) {
    const status = consulta.error instanceof ApiError ? consulta.error.status : 0;
    return (
      <Moldura>
        {status === 410 ? (
          <Expirado />
        ) : (
          <Mensagem icone={<TriangleAlert className="size-14 text-slate-500" />} titulo={status === 404 ? "Convite não encontrado" : "Não foi possível abrir o convite"}>
            <p>Confira o link que sua assessora enviou ou peça um novo.</p>
          </Mensagem>
        )}
      </Moldura>
    );
  }

  if (!consulta.data) {
    return (
      <Moldura>
        <div className="flex flex-col gap-4" aria-label="Carregando">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </Moldura>
    );
  }

  const convite = confirmar.data ?? consulta.data;
  const erroConfirmar = confirmar.error instanceof ApiError ? confirmar.error : null;

  if (convite.status === "CONFIRMADO") {
    return (
      <Moldura>
        <Sucesso convite={convite} />
      </Moldura>
    );
  }
  if (convite.status === "EXPIRADO" || erroConfirmar?.status === 410) {
    return (
      <Moldura>
        <Expirado />
      </Moldura>
    );
  }

  return (
    <Moldura>
      <div className="flex items-center gap-3">
        <LogoBanco convite={convite} />
        <div>
          <p className="text-xs text-muted-foreground">Você está no ambiente do</p>
          <h1 className="text-2xl font-bold tracking-tight">{convite.instituicaoNome}</h1>
        </div>
      </div>

      <p className="mt-6 text-[15px] leading-relaxed text-slate-700">
        A <strong>XP Investimentos</strong> pediu, pelo Open Finance, para ver estes dados seus no {convite.instituicaoNome}:
      </p>

      <ul data-testid="escopos" className="mt-4 flex flex-col gap-2">
        {convite.escopos.map((e) => (
          <li key={e} className="flex items-start gap-3 rounded-xl border p-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
            <div>
              <p className="font-semibold">{rotuloEscopo[e]}</p>
              <p className="text-sm text-slate-600">{descricaoEscopo[e]}</p>
            </div>
          </li>
        ))}
      </ul>

      <dl className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-4 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-600">Prazo</dt>
          <dd className="font-semibold">{convite.prazoMeses} meses</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-600">Quem recebe</dt>
          <dd className="font-semibold">XP Investimentos</dd>
        </div>
      </dl>

      <p className="mt-4 flex items-center gap-2 text-sm text-slate-600">
        <Lock className="size-4 shrink-0" /> Você pode revogar quando quiser. Só leitura: ninguém movimenta seu dinheiro.
      </p>

      {erroConfirmar && erroConfirmar.status !== 410 && (
        <p role="alert" className="mt-4 rounded-lg bg-slate-100 p-3 text-sm">
          Não foi possível confirmar agora. {erroConfirmar.message}
        </p>
      )}

      <div className="mt-auto pt-8">
        <Button
          size="lg"
          className="h-12 w-full text-base"
          disabled={confirmar.isPending}
          onClick={() => confirmar.mutate(token)}
        >
          {confirmar.isPending && <Loader2 className="animate-spin" />} Confirmar compartilhamento
        </Button>
      </div>
    </Moldura>
  );
}
