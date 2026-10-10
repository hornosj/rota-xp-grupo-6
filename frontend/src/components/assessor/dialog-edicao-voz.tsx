"use client";

import { useRef, useState } from "react";
import { ArrowRight, Check, FileAudio, Keyboard, Loader2, Mic, Square, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { BadgeGeradoPor, Sobretitulo, Vazio } from "@/components/comum/marcadores";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AlteracaoCampo, CampoCadastro, Cliente, EdicaoCadastro } from "@/lib/api-types";
import { useDemoEstado, useEditarCliente, usePropostaEdicao, useTranscreverAudio } from "@/lib/queries";
import { rotuloCampoCadastro } from "@/lib/rotulos";
import { LIMITE_GRAVACAO_S, podeGravar, useGravadorAudio, type Gravacao } from "./gravador-audio";
import { useDitado } from "./use-ditado";

type Etapa = "audio" | "texto" | "proposta";

const minutos = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const mensagemDe = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado");

function exibir(campo: CampoCadastro, valor?: string) {
  if (!valor) return "—";
  return campo === "IDADE" ? `${valor} anos` : valor;
}

function rotuloAplicar(n: number) {
  if (n === 0) return "Aplicar";
  return n === 1 ? "Aplicar 1 alteração" : `Aplicar ${n} alterações`;
}

/** Corpo do PATCH só com as alterações que o assessor deixou marcadas. */
export function edicaoDe(alteracoes: AlteracaoCampo[]): EdicaoCadastro {
  const e: EdicaoCadastro = {};
  for (const a of alteracoes) {
    if (a.campo === "NOME") e.nome = a.valorNovo;
    if (a.campo === "IDADE") e.idade = Number(a.valorNovo);
    if (a.campo === "PROFISSAO") e.profissao = a.valorNovo;
    if (a.campo === "CIDADE") e.cidade = a.valorNovo;
  }
  return e;
}

function Erro({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-[15px] font-semibold text-destructive">
      {children}
    </p>
  );
}

interface Props {
  cliente: Cliente;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Áudio → transcrição (Whisper) → proposta (Copiloto + regras) → o assessor confere e aplica. */
export function DialogEdicaoVoz({ cliente, open, onOpenChange }: Props) {
  const demo = useDemoEstado();
  // Backend sem o campo: tenta gravar mesmo assim; um 503 mostra o aviso e o assessor digita.
  const vozNoServidor = demo.data?.transcricao?.disponivel ?? true;
  const [etapa, setEtapa] = useState<Etapa>("audio");
  const [texto, setTexto] = useState("");
  const [modelo, setModelo] = useState<string | null>(null);
  const [desmarcados, setDesmarcados] = useState<Set<CampoCadastro>>(new Set());
  const arquivo = useRef<HTMLInputElement>(null);

  const transcrever = useTranscreverAudio();
  const propor = usePropostaEdicao();
  const editar = useEditarCliente();

  function enviarAudio({ audio, nomeArquivo }: Gravacao) {
    transcrever.mutate(
      { clienteId: cliente.id, audio, nomeArquivo },
      {
        onSuccess: (t) => {
          setTexto(t.texto);
          setModelo(t.modelo);
          setEtapa("texto");
        },
      },
    );
  }
  const gravador = useGravadorAudio(enviarAudio);
  // Sem Whisper no servidor, o ditado do navegador (Chrome/Edge) faz o papel do microfone.
  const ditado = useDitado((trecho) => setTexto((t) => (t.trim() ? `${t.trim()} ${trecho}` : trecho)));

  function entender() {
    setDesmarcados(new Set());
    propor.mutate({ clienteId: cliente.id, transcricao: texto }, { onSuccess: () => setEtapa("proposta") });
  }

  function alternar(campo: CampoCadastro) {
    setDesmarcados((d) => {
      const n = new Set(d);
      if (!n.delete(campo)) n.add(campo);
      return n;
    });
  }

  const proposta = propor.data;
  const marcadas = proposta?.alteracoes.filter((a) => !desmarcados.has(a.campo)) ?? [];

  function aplicar() {
    editar.mutate(
      { clienteId: cliente.id, edicao: edicaoDe(marcadas) },
      {
        onSuccess: () => {
          toast.success("Cadastro atualizado");
          onOpenChange(false);
        },
      },
    );
  }

  // Sem Whisper no servidor, a etapa de áudio não tem o que fazer: vai direto para o texto.
  const atual: Etapa = etapa === "audio" && !vozNoServidor ? "texto" : etapa;
  const gravando = gravador.estado === "gravando";
  const ocupado = gravando || gravador.estado === "pedindo" || transcrever.isPending;
  const navegadorGrava = podeGravar();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto p-6 sm:max-w-2xl sm:p-9">
        <DialogHeader className="gap-2 pr-10">
          <Sobretitulo>Editar cadastro por voz</Sobretitulo>
          <DialogTitle className="text-3xl leading-tight font-extrabold tracking-tight">{cliente.nome}</DialogTitle>
          <DialogDescription className="text-[17px] text-muted-foreground">
            Conte o que mudou no nome, na idade, na profissão ou na cidade. Você confere tudo antes de salvar.
          </DialogDescription>
        </DialogHeader>

        {atual === "audio" && (
          <>
            <div className="flex flex-col items-center gap-3 rounded-3xl bg-muted p-8 text-center">
              {transcrever.isPending ? (
                <p role="status" className="flex items-center gap-2 text-lg font-semibold">
                  <Loader2 className="size-5 animate-spin" /> Transcrevendo o áudio…
                </p>
              ) : gravando ? (
                <>
                  <span className="text-5xl font-extrabold tracking-tight tabular-nums" aria-live="polite">
                    {minutos(gravador.segundos)}
                  </span>
                  <p className="text-[15px] text-muted-foreground">Gravando. Para sozinho em {minutos(LIMITE_GRAVACAO_S)}.</p>
                  <Button size="lg" onClick={gravador.parar}>
                    <Square /> Parar e transcrever
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="icon-lg"
                    className="size-20 [&_svg:not([class*='size-'])]:size-8"
                    aria-label="Gravar áudio"
                    onClick={gravador.iniciar}
                    disabled={!navegadorGrava || ocupado}
                  >
                    <Mic />
                  </Button>
                  <p className="text-lg font-semibold">
                    {navegadorGrava ? "Toque para gravar" : "Este navegador não grava áudio: envie um arquivo ou digite."}
                  </p>
                  <p className="text-[15px] text-muted-foreground">
                    Ex.: “A Patrícia se mudou para Campinas e agora trabalha como consultora educacional.”
                  </p>
                </>
              )}
            </div>
            {gravador.erro && <Erro>{gravador.erro}</Erro>}
            {transcrever.isError && <Erro>{mensagemDe(transcrever.error)}</Erro>}
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="lg" onClick={() => arquivo.current?.click()} disabled={ocupado}>
                <FileAudio /> Enviar arquivo de áudio
              </Button>
              <input
                ref={arquivo}
                type="file"
                accept="audio/*"
                aria-label="Arquivo de áudio"
                tabIndex={-1}
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) enviarAudio({ audio: f, nomeArquivo: f.name });
                }}
              />
              <Button variant="ghost" size="lg" onClick={() => setEtapa("texto")} disabled={ocupado}>
                <Keyboard /> Prefiro digitar
              </Button>
            </div>
          </>
        )}

        {atual === "texto" && (
          <>
            {!vozNoServidor && ditado.suportado && (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-dashed p-4">
                {ditado.gravando ? (
                  <Button size="lg" onClick={ditado.parar}>
                    <Square /> Parar
                  </Button>
                ) : (
                  <Button size="lg" onClick={ditado.iniciar}>
                    <Mic /> Gravar áudio
                  </Button>
                )}
                <p className="text-[15px]">
                  {ditado.gravando
                    ? "Gravando… fale em português."
                    : "Fale o que mudou: o ditado do navegador transcreve aqui mesmo. Você pode corrigir antes de seguir."}
                </p>
                {ditado.parcial && <p className="w-full text-[15px] text-muted-foreground italic">{ditado.parcial}…</p>}
                {ditado.erro && <Erro>{ditado.erro}</Erro>}
              </div>
            )}
            {!vozNoServidor && !ditado.suportado && (
              <p className="rounded-2xl border-2 border-dashed p-4 text-[15px]">
                A transcrição por voz não está configurada no servidor. Digite o que mudou: a IA entende do mesmo jeito.
              </p>
            )}
            <div className="flex flex-col gap-2">
              <label htmlFor="edicao-voz-texto" className="text-base font-bold">
                O que mudou
              </label>
              <textarea
                id="edicao-voz-texto"
                rows={5}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Ex.: A Patrícia se mudou para Campinas e agora trabalha como consultora educacional."
                className="w-full rounded-xl border-2 border-input bg-background px-4 py-3 text-base outline-none focus-visible:border-black focus-visible:ring-3 focus-visible:ring-black/15"
              />
              {modelo && (
                <p className="text-sm text-muted-foreground">Transcrito por {modelo}. Corrija o que precisar antes de seguir.</p>
              )}
            </div>
            {propor.isError && <Erro>{mensagemDe(propor.error)}</Erro>}
            <div className="flex flex-wrap gap-3">
              <Button size="lg" onClick={entender} disabled={!texto.trim() || propor.isPending || ditado.gravando}>
                {propor.isPending ? <Loader2 className="animate-spin" /> : <ArrowRight />} Ver alterações
              </Button>
              {vozNoServidor && (
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => {
                    transcrever.reset();
                    setEtapa("audio");
                  }}
                >
                  <Mic /> Gravar de novo
                </Button>
              )}
            </div>
          </>
        )}

        {atual === "proposta" && proposta && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Sobretitulo className="text-[13px]">Alterações sugeridas</Sobretitulo>
              <BadgeGeradoPor geradoPor={proposta.geradoPor} />
            </div>
            {proposta.alteracoes.length === 0 ? (
              <Vazio>Não encontrei mudança de nome, idade, profissão ou cidade nessa fala.</Vazio>
            ) : (
              <ul className="flex flex-col divide-y overflow-hidden rounded-2xl border-2 border-black">
                {proposta.alteracoes.map((a) => (
                  <li key={a.campo}>
                    <label className="flex cursor-pointer items-center gap-4 p-4 hover:bg-muted/60">
                      <input
                        type="checkbox"
                        className="size-5 shrink-0 accent-black"
                        checked={!desmarcados.has(a.campo)}
                        onChange={() => alternar(a.campo)}
                      />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-sm font-bold tracking-wide uppercase">{rotuloCampoCadastro[a.campo]}</span>
                        <span className="flex flex-wrap items-center gap-x-2 text-[17px]">
                          <span className="text-muted-foreground line-through">{exibir(a.campo, a.valorAtual)}</span>
                          <ArrowRight className="size-4 shrink-0" aria-label="para" />
                          <strong>{exibir(a.campo, a.valorNovo)}</strong>
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {proposta.avisos.length > 0 && (
              <ul className="flex flex-col gap-2">
                {proposta.avisos.map((aviso) => (
                  <li key={aviso} className="flex gap-2 text-[15px]">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {aviso}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[15px] text-muted-foreground">
              Nada muda até você aplicar. A IA só interpreta a fala; cada campo passa pelas regras de validação.
            </p>
            {editar.isError && <Erro>{mensagemDe(editar.error)}</Erro>}
            <div className="flex flex-wrap gap-3">
              <Button size="lg" onClick={aplicar} disabled={marcadas.length === 0 || editar.isPending}>
                {editar.isPending ? <Loader2 className="animate-spin" /> : <Check />} {rotuloAplicar(marcadas.length)}
              </Button>
              <Button variant="ghost" size="lg" onClick={() => setEtapa("texto")} disabled={editar.isPending}>
                Voltar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Botão do cabeçalho da 360. O diálogo só monta aberto: cada abertura começa do zero. */
export function BotaoEdicaoVoz({ cliente }: { cliente: Cliente }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setAberto(true)}>
        <Mic /> Editar por voz
      </Button>
      {aberto && <DialogEdicaoVoz cliente={cliente} open={aberto} onOpenChange={setAberto} />}
    </>
  );
}
