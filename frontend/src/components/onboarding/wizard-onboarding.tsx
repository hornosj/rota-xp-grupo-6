"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Check, CheckCircle2, Compass, Loader2, ShieldCheck, Trophy } from "lucide-react";
import { toast } from "sonner";
import { ChipPerfil, ErroCarregar } from "@/components/comum/marcadores";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api-base";
import type { ResultadoOnboarding } from "@/lib/api-types";
import { useConcluirOnboarding, useDemoEstado, useFormularioOnboarding } from "@/lib/queries";
import { rotuloPerfil } from "@/lib/rotulos";
import { cn } from "@/lib/utils";
import {
  EtapaBoasVindas,
  EtapaCompartilhamento,
  EtapaDados,
  EtapaEndereco,
  EtapaFamilia,
  EtapaInstituicoes,
  EtapaPerfil,
  EtapaRevisao,
  type PropsEtapa,
} from "./etapas";
import { ETAPAS, type Erros, type EstadoFormulario, estadoInicial, montarCadastro, validarEtapa } from "./formulario";

const hojeLocal = () => new Date().toLocaleDateString("sv-SE");

function Progresso({ atual }: { atual: number }) {
  const total = ETAPAS.length - 1; // a boas-vindas não conta
  return (
    <div className="flex items-center gap-3" aria-label={`Etapa ${atual} de ${total}`}>
      <div className="flex flex-1 gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < atual ? "bg-slate-900" : "bg-slate-200")} />
        ))}
      </div>
      <span className="text-xs whitespace-nowrap text-muted-foreground">
        {atual} de {total}
      </span>
    </div>
  );
}

/** Barra lateral do desktop: marca, convite e lista de etapas. */
function Lateral({ nome, atual, irPara }: { nome?: string; atual?: number; irPara?: (n: number) => void }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-80 shrink-0 flex-col gap-8 bg-slate-900 p-8 text-white lg:flex xl:w-96">
      <p className="flex items-center gap-2 font-bold tracking-tight">
        <Compass className="size-5" /> XP · Cadastro de investidor
      </p>
      {nome && <p className="text-sm text-slate-300">Convite para {nome}</p>}
      {atual !== undefined && (
        <ol className="flex flex-col gap-1">
          {ETAPAS.map((e, i) => {
            const feita = i < atual;
            const corrente = i === atual;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  disabled={!feita}
                  onClick={() => irPara?.(i)}
                  aria-current={corrente ? "step" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition",
                    corrente ? "bg-white/10 font-semibold text-white" : feita ? "text-slate-200 hover:bg-white/5" : "text-slate-500",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-xs",
                      feita ? "bg-emerald-500 text-white" : corrente ? "bg-white text-slate-900" : "border border-slate-600",
                    )}
                  >
                    {feita ? <Check className="size-3.5" /> : i}
                  </span>
                  {e.titulo}
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-auto flex items-start gap-2 text-xs text-slate-400">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        Seus dados são protegidos pela LGPD. Você decide o que compartilhar.
      </p>
    </aside>
  );
}

/** Tela cheia: lateral no desktop e conteúdo centralizado com largura de leitura. */
function Casca({ children, lateral }: { children: React.ReactNode; lateral?: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      {lateral ?? <Lateral />}
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

const coluna = "mx-auto w-full max-w-2xl px-4 sm:px-8";

function Concluido({ resultado, nome }: { resultado: Pick<ResultadoOnboarding, "clienteId" | "perfil" | "consentimentos">; nome: string }) {
  const pendentes = resultado.consentimentos.filter((c) => c.status !== "ATIVO");
  const ativas = resultado.consentimentos.filter((c) => c.status === "ATIVO");
  return (
    <Casca>
      <div className={cn(coluna, "flex flex-col gap-5 pt-10 pb-10 sm:pt-16")} data-testid="onboarding-concluido">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="size-9 text-emerald-600" />
          </span>
          <h1 className="text-2xl font-bold">Tudo pronto, {nome.split(" ")[0]}!</h1>
          <p className="text-sm text-slate-600">Seu cadastro foi enviado para a sua assessoria.</p>
        </div>
        <div className="rounded-2xl border p-4 text-center">
          <p className="text-sm text-muted-foreground">Seu perfil de investidor</p>
          <p className="mt-1 text-2xl font-bold" data-testid="perfil-resultado">
            {rotuloPerfil[resultado.perfil]}
          </p>
          <ChipPerfil perfil={resultado.perfil} className="mt-2" />
        </div>
        <div className="rounded-2xl border p-4">
          <p className="font-semibold">Seus dados compartilhados</p>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {ativas.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600" /> {c.instituicaoNome}
              </li>
            ))}
            {pendentes.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <span className="size-4 rounded-full border-2 border-dashed border-slate-300" /> {c.instituicaoNome}
                <span className="ml-auto text-xs font-medium text-amber-700">pendente</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-slate-600">
          Pode fechar esta página. Sua assessoria vai entrar em contato pelo celular que você informou.
          {pendentes.length > 0 && " Para conectar as instituições pendentes depois, é só pedir um novo link."}
        </p>
      </div>
    </Casca>
  );
}

export function EsqueletoOnboarding() {
  return (
    <div className={cn(coluna, "flex flex-col gap-4 pt-10")} aria-label="Carregando">
      <Skeleton className="h-36 rounded-2xl" />
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}

export function RotaOnboarding() {
  const { token } = useParams<{ token: string }>();
  return <WizardOnboarding key={token} token={token} />;
}

export function WizardOnboarding({ token }: { token: string }) {
  const formulario = useFormularioOnboarding(token);
  const demo = useDemoEstado();
  const concluir = useConcluirOnboarding();
  const [etapa, setEtapa] = useState(0);
  const [f, setF] = useState<EstadoFormulario | null>(null);
  const [erros, setErros] = useState<Erros>({});
  const [resultado, setResultado] = useState<ResultadoOnboarding | null>(null);

  if (formulario.isError) {
    const naoExiste = formulario.error instanceof ApiError && formulario.error.status === 404;
    return (
      <Casca>
        <div className={cn(coluna, "pt-10 sm:pt-16")}>
          {naoExiste ? (
            <div className="rounded-2xl border p-6 text-center">
              <h1 className="text-lg font-bold">Link inválido</h1>
              <p className="mt-2 text-sm text-slate-600">
                Este link de cadastro não existe ou expirou. Peça um novo link à sua assessoria.
              </p>
            </div>
          ) : (
            <ErroCarregar erro={formulario.error} />
          )}
        </div>
      </Casca>
    );
  }
  if (!formulario.data) return <EsqueletoOnboarding />;

  const form = formulario.data;
  const { convite } = form;
  if (resultado) return <Concluido resultado={resultado} nome={resultado.convite.nome} />;
  if (convite.status === "CONCLUIDO" && convite.clienteId) {
    return (
      <Casca>
        <div className={cn(coluna, "flex flex-col gap-4 pt-10 text-center sm:pt-16")}>
          <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
          <h1 className="text-xl font-bold">Cadastro já concluído</h1>
          <p className="text-sm text-slate-600">
            Este link já foi usado{convite.perfil && <> e seu perfil é {rotuloPerfil[convite.perfil]}</>}.
          </p>
          <p className="text-sm text-slate-600">Sua assessoria já recebeu seu cadastro.</p>
        </div>
      </Casca>
    );
  }

  const estado = f ?? estadoInicial(convite.nome);
  const hoje = demo.data?.dataReferencia ?? hojeLocal();
  const ultima = etapa === ETAPAS.length - 1;

  const set = (patch: Partial<EstadoFormulario>) => {
    setF({ ...estado, ...patch });
    if (Object.keys(erros).length) setErros({});
  };

  const irPara = (n: number) => {
    setErros({});
    setEtapa(n);
    window.scrollTo?.({ top: 0 });
  };

  async function avancar() {
    const e = validarEtapa(ETAPAS[etapa].id, estado, { hoje, questionario: form.questionario });
    if (Object.keys(e).length) {
      setErros(e);
      return;
    }
    if (!ultima) {
      irPara(etapa + 1);
      return;
    }
    try {
      setResultado(await concluir.mutateAsync({ token, cadastro: montarCadastro(estado) }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível concluir agora. Tente de novo.");
    }
  }

  const props: PropsEtapa = { f: estado, set, erros, formulario: form };
  const conteudo = [
    <EtapaBoasVindas key="0" {...props} />,
    <EtapaDados key="1" {...props} />,
    <EtapaEndereco key="2" {...props} />,
    <EtapaFamilia key="3" {...props} />,
    <EtapaPerfil key="4" {...props} />,
    <EtapaInstituicoes key="5" {...props} />,
    <EtapaCompartilhamento key="6" {...props} />,
    <EtapaRevisao key="7" {...props} irPara={irPara} />,
  ][etapa];

  return (
    <Casca lateral={<Lateral nome={convite.nome} atual={etapa} irPara={irPara} />}>
      {etapa > 0 && (
        <div className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur">
          <div className={cn(coluna, "flex flex-col gap-3 pt-4 pb-3")}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => irPara(etapa - 1)}
                aria-label="Voltar"
                className="rounded-full p-1 hover:bg-slate-100"
              >
                <ArrowLeft className="size-5" />
              </button>
              <span className="text-sm font-medium">{ETAPAS[etapa].titulo}</span>
            </div>
            <Progresso atual={etapa} />
          </div>
        </div>
      )}
      <form
        className="flex flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          void avancar();
        }}
        noValidate
      >
        <div className={cn(coluna, "flex flex-1 flex-col gap-6 pt-5 pb-8 sm:pt-10")}>{conteudo}</div>
        <div className="sticky bottom-0 z-10 border-t bg-white">
          <div className={cn(coluna, "flex justify-end py-4")}>
            <Button type="submit" className="h-11 w-full text-base sm:w-auto sm:min-w-48" disabled={concluir.isPending}>
              {concluir.isPending ? (
                <>
                  <Loader2 className="animate-spin" /> Enviando…
                </>
              ) : etapa === 0 ? (
                "Começar"
              ) : ultima ? (
                "Concluir cadastro"
              ) : (
                "Continuar"
              )}
            </Button>
          </div>
        </div>
      </form>
    </Casca>
  );
}
