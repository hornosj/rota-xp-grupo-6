"use client";

import { useState } from "react";
import { Loader2, Mic, NotebookPen, Save, Square, Upload } from "lucide-react";
import { toast } from "sonner";
import { BadgeGeradoPor } from "@/components/comum/marcadores";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Id, ResultadoNota } from "@/lib/api-types";
import { useDemoEstado, useRegistrarNota, useTranscreverAudio } from "@/lib/queries";
import { podeGravar, useGravadorAudio, type Gravacao } from "./gravador-audio";
import { ListaProdutosSugeridos } from "./lista-produtos-sugeridos";
import { useDitado } from "./use-ditado";

const MAX_CARACTERES = 2000;
/** Transcrição de exemplo para a demo (PLAN §8.4). */
const EXEMPLO = "Bateu o carro semana passada e está sem seguro. Quer juntar dinheiro para a faculdade do filho.";

/**
 * "Nota de contexto": o assessor grava um áudio (ou escreve) sobre a vida do cliente; vira contexto do Copiloto e
 * sugere produtos. Não confundir com "Editar por voz" (dialog-edicao-voz), que altera os campos do cadastro.
 */
export function DialogEditarCliente({ clienteId, nome }: { clienteId: Id; nome: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setAberto(true)}>
        <NotebookPen /> Nota de contexto
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto p-6 sm:max-w-2xl sm:p-9">
          <DialogHeader>
            <DialogTitle className="text-3xl leading-tight font-extrabold tracking-tight">Nota de contexto: {nome}</DialogTitle>
            <DialogDescription>
              Grave um áudio ou escreva o que mudou na vida do cliente (ex.: “bateu o carro”). O Copiloto usa a nota no
              briefing e nas mensagens e sugere produtos.
            </DialogDescription>
          </DialogHeader>
          {aberto && <FormNota clienteId={clienteId} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function FormNota({ clienteId }: { clienteId: Id }) {
  const [texto, setTexto] = useState("");
  const [usouAudio, setUsouAudio] = useState(false);
  const ditado = useDitado((trecho) => acrescentar(trecho));
  const nota = useRegistrarNota();
  const demo = useDemoEstado();
  const whisper = demo.data?.transcricao?.disponivel === true;
  function acrescentar(trecho: string) {
    setTexto((t) => (t.trim() ? `${t.trim()} ${trecho}` : trecho));
    setUsouAudio(true);
  }

  function salvar() {
    nota.mutate(
      { clienteId, transcricao: texto.trim(), origem: usouAudio ? "AUDIO" : "TEXTO" },
      {
        onSuccess: () => {
          toast.success("Nota salva no contexto do cliente");
          setTexto("");
          setUsouAudio(false);
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {ditado.suportado ? (
        <div className="flex flex-wrap items-center gap-3">
          {ditado.gravando ? (
            <Button variant="destructive" onClick={ditado.parar}>
              <Square /> Parar
            </Button>
          ) : (
            <Button variant="outline" onClick={ditado.iniciar}>
              <Mic /> Gravar áudio
            </Button>
          )}
          {ditado.gravando && (
            <span className="flex items-center gap-2 text-sm text-red-600">
              <span className="size-2 animate-pulse rounded-full bg-red-600" /> Gravando… fale em português
            </span>
          )}
        </div>
      ) : whisper ? (
        <GravacaoWhisper clienteId={clienteId} aoTranscrever={acrescentar} />
      ) : (
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          A gravação por voz funciona no Chrome ou Edge. Aqui você pode digitar a nota (ou usar o ditado do seu sistema).
        </p>
      )}
      {ditado.erro && (
        <p role="alert" className="text-sm text-red-600">
          {ditado.erro}
        </p>
      )}

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Nota sobre o cliente
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={4}
          maxLength={MAX_CARACTERES}
          placeholder="Ex.: Bateu o carro semana passada e está sem seguro."
          className="rounded-md border bg-background p-2.5 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      </label>
      {ditado.parcial && <p className="text-sm text-muted-foreground italic">{ditado.parcial}…</p>}

      <DialogFooter>
        <Button variant="ghost" onClick={() => setTexto(EXEMPLO)} disabled={ditado.gravando}>
          Usar exemplo
        </Button>
        <Button onClick={salvar} disabled={!texto.trim() || nota.isPending || ditado.gravando}>
          {nota.isPending ? <Loader2 className="animate-spin" /> : <Save />} Salvar nota
        </Button>
      </DialogFooter>

      {nota.isError && (
        <p role="alert" className="rounded-md bg-slate-100 p-3 text-sm">
          Não foi possível salvar a nota. {nota.error instanceof Error ? nota.error.message : ""}
        </p>
      )}
      {nota.data && <ResultadoDaNota r={nota.data} />}
    </div>
  );
}

function ResultadoDaNota({ r }: { r: ResultadoNota }) {
  return (
    <div data-testid="resultado-nota" className="flex flex-col gap-2 rounded-lg border bg-emerald-50/60 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">{r.resumo ?? "Nota registrada."}</p>
        <BadgeGeradoPor geradoPor={r.geradoPor} />
      </div>
      {r.recomendacoes.length > 0 ? (
        <>
          <p className="text-xs font-medium text-muted-foreground uppercase">Produtos para oferecer</p>
          <ListaProdutosSugeridos recomendacoes={r.recomendacoes} />
        </>
      ) : (
        <p className="text-muted-foreground">Nenhum produto novo sugerido por esta nota.</p>
      )}
      {r.eventosCriados.length > 0 && (
        <p>Eventos de vida registrados: {r.eventosCriados.map((e) => e.descricao).join("; ")}.</p>
      )}
    </div>
  );
}

/** Sem ditado no navegador (Firefox, Safari): grava ou envia o áudio e o Whisper do servidor transcreve. */
function GravacaoWhisper({ clienteId, aoTranscrever }: { clienteId: Id; aoTranscrever: (texto: string) => void }) {
  const transcrever = useTranscreverAudio();
  function enviar({ audio, nomeArquivo }: Gravacao) {
    transcrever.mutate({ clienteId, audio, nomeArquivo }, { onSuccess: (t) => aoTranscrever(t.texto) });
  }
  const gravador = useGravadorAudio(enviar);
  const gravando = gravador.estado === "gravando";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {gravando ? (
          <Button variant="destructive" onClick={gravador.parar}>
            <Square /> Parar ({gravador.segundos}s)
          </Button>
        ) : (
          <Button variant="outline" onClick={gravador.iniciar} disabled={!podeGravar() || transcrever.isPending}>
            <Mic /> Gravar áudio
          </Button>
        )}
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <Upload className="size-4" /> Arquivo de áudio
          <input
            type="file"
            accept="audio/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) enviar({ audio: f, nomeArquivo: f.name });
              e.target.value = "";
            }}
          />
        </label>
        {transcrever.isPending && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Transcrevendo…
          </span>
        )}
      </div>
      {(gravador.erro || transcrever.isError) && (
        <p role="alert" className="text-sm text-red-600">
          {gravador.erro ?? (transcrever.error instanceof Error ? transcrever.error.message : "Não foi possível transcrever.")}
        </p>
      )}
    </div>
  );
}
