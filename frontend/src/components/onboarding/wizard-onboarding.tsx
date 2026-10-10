"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Check, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Marca } from "@/components/comum/cabecalho-app";
import { ErroCarregar, Sobretitulo } from "@/components/comum/marcadores";
import { Button } from "@/components/ui/button";
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
const TOTAL = ETAPAS.length - 1; // a boas-vindas não conta

function Progresso({ atual }: { atual: number }) {
  return (
    <div className="flex items-center gap-3" aria-label={`Etapa ${atual} de ${TOTAL}`}>
      <div className="flex gap-1">
        {Array.from({ length: TOTAL }, (_, i) => (
          <span key={i} className={cn("h-1.5 w-6 rounded-full sm:w-8", i < atual ? "bg-black" : "bg-[#d9d9d9]")} />
        ))}
      </div>
      <span className="text-[15px] whitespace-nowrap text-muted-foreground">
        {atual} de {TOTAL}
      </span>
    </div>
  );
}

/** Lista de etapas no desktop (fundo cinza claro, ao lado do formulário). */
function Lateral({ atual, irPara }: { atual: number; irPara: (n: number) => void }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-80 shrink-0 flex-col gap-8 self-start bg-muted p-8 lg:flex">
      <ol className="flex flex-col gap-0.5">
        {ETAPAS.map((e, i) => {
          const feita = i < atual;
          const corrente = i === atual;
          return (
            <li key={e.id}>
              <button
                type="button"
                disabled={!feita}
                onClick={() => irPara(i)}
                aria-current={corrente ? "step" : undefined}
                className="flex w-full items-center gap-3.5 rounded-lg py-2.5 text-left text-[17px] enabled:hover:underline"
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold",
                    feita && "bg-black text-white",
                    corrente && "bg-black text-white ring-4 ring-black/20",
                    !feita && !corrente && "border-2 border-[#8a8a8a] bg-white text-muted-foreground",
                  )}
                >
                  {feita ? <Check className="size-4" /> : i + 1}
                </span>
                <span
                  className={cn(
                    corrente ? "font-extrabold underline underline-offset-4" : feita ? "font-medium" : "text-muted-foreground",
                  )}
                >
                  {e.titulo}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-auto flex items-start gap-2 text-[15px]">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" />
        Seus dados são protegidos pela LGPD. Você decide o que compartilhar.
      </p>
    </aside>
  );
}

/** Tela cheia: barra preta com a marca (e o progresso), lista de etapas no desktop e conteúdo com largura de leitura. */
function Casca({
  children,
  lateral,
  nome,
  progresso,
}: {
  children: React.ReactNode;
  lateral?: React.ReactNode;
  nome?: string;
  progresso?: number;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-black text-white">
        <div className="flex min-h-18 items-center justify-between gap-4 px-4 sm:px-8 lg:px-16">
          <Marca complemento="Cadastro de investidor" />
          <span className="flex items-center gap-2 text-[15px] text-white/80">
            {nome ? (
              `Convite para ${nome}`
            ) : (
              <>
                <ShieldCheck className="size-4" /> Ambiente seguro · LGPD
              </>
            )}
          </span>
        </div>
        {progresso !== undefined && (
          <div className="h-1.5 bg-white/30" aria-hidden>
            <div className="h-full bg-white transition-all duration-500" style={{ width: `${Math.round(progresso * 100)}%` }} />
          </div>
        )}
      </header>
      <div className="flex flex-1">
        {lateral}
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}

const coluna = "mx-auto w-full max-w-3xl px-4 sm:px-10";

function Concluido({ resultado, nome }: { resultado: Pick<ResultadoOnboarding, "clienteId" | "perfil" | "consentimentos">; nome: string }) {
  const pendentes = resultado.consentimentos.filter((c) => c.status !== "ATIVO");
  const ativas = resultado.consentimentos.filter((c) => c.status === "ATIVO");
  return (
    <Casca>
      <div
        className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-12 sm:px-10 sm:py-20 lg:grid-cols-[1.1fr_1fr]"
        data-testid="onboarding-concluido"
      >
        <div className="flex flex-col gap-6">
          <span className="flex size-18 items-center justify-center rounded-full bg-black text-white">
            <Check className="size-9" strokeWidth={2.6} />
          </span>
          <h1 className="text-5xl leading-[0.95] font-extrabold tracking-tight sm:text-7xl">
            Tudo pronto, {nome.split(" ")[0]}!
          </h1>
          <p className="max-w-xl text-xl leading-relaxed text-muted-foreground">
            Seu cadastro foi enviado para a sua assessoria. Pode fechar esta página: sua assessoria vai entrar em contato
            pelo celular que você informou.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-2 rounded-3xl bg-black p-7 text-white">
            <Sobretitulo className="text-white/80">Seu perfil de investidor</Sobretitulo>
            <p className="text-5xl font-extrabold tracking-tight" data-testid="perfil-resultado">
              {rotuloPerfil[resultado.perfil]}
            </p>
          </section>
          <section className="flex flex-col gap-4 rounded-3xl border-2 border-black p-7">
            <Sobretitulo>Dados compartilhados</Sobretitulo>
            <ul className="flex flex-col gap-3.5 text-lg">
              {ativas.map((c) => (
                <li key={c.id} className="flex items-center gap-3">
                  <span className="flex size-6 items-center justify-center rounded-full bg-black text-white">
                    <Check className="size-3.5" />
                  </span>
                  {c.instituicaoNome}
                  <span className="ml-auto text-base font-bold">ativo</span>
                </li>
              ))}
              {pendentes.map((c) => (
                <li key={c.id} className="flex items-center gap-3">
                  <span className="size-6 rounded-full border-2 border-dashed border-black" />
                  {c.instituicaoNome}
                  <span className="ml-auto text-base text-muted-foreground">pendente</span>
                </li>
              ))}
            </ul>
            {pendentes.length > 0 && (
              <p className="border-t pt-3 text-[15px] text-muted-foreground">
                Para conectar as instituições pendentes depois, é só pedir um novo link à sua assessoria.
              </p>
            )}
          </section>
        </div>
      </div>
    </Casca>
  );
}

export function EsqueletoOnboarding() {
  return (
    <div className={cn(coluna, "flex flex-col gap-4 pt-10")} aria-label="Carregando">
      <Skeleton className="h-36 rounded-3xl" />
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-14 w-full rounded-full" />
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
            <div className="flex flex-col gap-3 rounded-3xl border-2 border-black p-8">
              <h1 className="text-3xl font-extrabold tracking-tight">Link inválido</h1>
              <p className="text-lg text-muted-foreground">
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
      <Casca nome={convite.nome}>
        <div className={cn(coluna, "flex flex-col gap-4 pt-12 sm:pt-20")}>
          <span className="flex size-16 items-center justify-center rounded-full bg-black text-white">
            <Check className="size-8" strokeWidth={2.6} />
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight">Cadastro já concluído</h1>
          <p className="text-lg text-muted-foreground">
            Este link já foi usado{convite.perfil && <> e seu perfil é {rotuloPerfil[convite.perfil]}</>}.
          </p>
          <p className="text-lg text-muted-foreground">Sua assessoria já recebeu seu cadastro.</p>
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
    <Casca nome={convite.nome} progresso={etapa / TOTAL} lateral={<Lateral atual={etapa} irPara={irPara} />}>
      {etapa > 0 && (
        <div className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur">
          <div className={cn(coluna, "flex flex-wrap items-center justify-between gap-3 py-4")}>
            <span className="text-base font-bold">{ETAPAS[etapa].titulo}</span>
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
        <div className={cn(coluna, "flex flex-1 flex-col gap-7 pt-8 pb-10 sm:pt-12")}>{conteudo}</div>
        <div className="sticky bottom-0 z-10 border-t bg-white">
          <div className={cn(coluna, "flex items-center justify-between gap-3 py-4")}>
            {etapa > 0 ? (
              <Button type="button" variant="ghost" size="lg" className="px-3" onClick={() => irPara(etapa - 1)}>
                <ArrowLeft /> Voltar
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" size="lg" className="flex-1 sm:min-w-56 sm:flex-none" disabled={concluir.isPending}>
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
