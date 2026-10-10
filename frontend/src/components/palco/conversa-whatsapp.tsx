"use client";

import { Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCheck, Lock, UserRound } from "lucide-react";
import { idAcaoConvidar } from "@/components/assessor/cobertura-convites";
import { api } from "@/lib/api";
import type { Convite } from "@/lib/api-types";

/** O convite mais recente (por criadoEm) de uma lista. */
export function ultimoConvite(convites: Convite[] | undefined): Convite | undefined {
  if (!convites?.length) return undefined;
  return [...convites].sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())[0];
}

function caminhoDoLink(link: string): string {
  try {
    const u = new URL(link, "http://localhost");
    return u.pathname + u.search;
  } catch {
    return link;
  }
}

/** Texto da mensagem do convite: o do Copiloto (mensagem da ação CONVIDAR_CONEXAO) enquanto PENDENTE. */
function useTextoConvite(convite: Convite | undefined) {
  return useQuery({
    queryKey: ["palco", "mensagem-convite", convite?.token],
    queryFn: async () =>
      (await api.mensagem(convite!.clienteId, idAcaoConvidar(convite!.clienteId, convite!.instituicaoId), "WHATSAPP")).texto,
    enabled: !!convite && convite.status === "PENDENTE",
    staleTime: Infinity,
    retry: false,
  });
}

function hora(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Quebra o texto no link do convite e transforma o link em âncora clicável. */
function TextoComLink({ texto, convite, onAbrir }: { texto: string; convite: Convite; onAbrir: () => void }) {
  // Se o texto (LLM) não trouxer o link literal, o link vai no fim da mensagem.
  const partes = texto.includes(convite.link) ? texto.split(convite.link) : [`${texto}\n`, ""];
  return (
    <>
      {partes.map((p, i) => (
        <Fragment key={i}>
          {p}
          {i < partes.length - 1 && (
            <a
              href={caminhoDoLink(convite.link)}
              onClick={(e) => {
                e.preventDefault();
                onAbrir();
              }}
              className="break-all text-sky-700 underline"
            >
              {convite.link}
            </a>
          )}
        </Fragment>
      ))}
    </>
  );
}

interface Props {
  convite: Convite | undefined;
  /** Token do convite aberto dentro do celular (ou null = conversa). */
  aberto: string | null;
  onAbrir: (token: string | null) => void;
}

/** Celular da Marina: conversa simulada de WhatsApp com a assessora. */
export function ConversaWhatsApp({ convite, aberto, onAbrir }: Props) {
  const texto = useTextoConvite(convite);

  if (aberto) {
    return (
      <div className="flex size-full flex-col">
        <button
          type="button"
          onClick={() => onAbrir(null)}
          className="flex h-11 shrink-0 items-center gap-2 bg-emerald-800 px-3 pt-4 text-sm font-medium text-white"
        >
          <ArrowLeft className="size-4" /> Voltar ao WhatsApp
        </button>
        <iframe title="Convite no celular" src={`/convite/${encodeURIComponent(aberto)}`} className="min-h-0 w-full flex-1 border-0" />
      </div>
    );
  }

  const fallback = convite
    ? `Oi, Marina! Para conectar o ${convite.instituicaoNome} pelo Open Finance, é por aqui: ${convite.link}`
    : "";
  const textoFinal = texto.data ?? (texto.isPending && convite?.status === "PENDENTE" ? null : fallback);

  return (
    <div className="flex size-full flex-col bg-[#efeae2]">
      <header className="flex shrink-0 items-center gap-3 bg-emerald-800 px-4 pt-8 pb-3 text-white">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-emerald-200 text-emerald-900">
          <UserRound className="size-5" />
        </span>
        <div className="leading-tight">
          <p className="font-semibold">Assessora XP</p>
          <p className="text-xs text-emerald-100">WhatsApp · online</p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        <p className="mx-auto flex max-w-[85%] items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-center text-[11px] text-slate-600">
          <Lock className="size-3 shrink-0" /> Conversa simulada para a demonstração.
        </p>

        {convite && (
          <div
            data-testid="bolha-assessora"
            className="max-w-[85%] self-start rounded-lg rounded-tl-none bg-white px-3 py-2 text-[15px] leading-snug shadow-sm"
          >
            {textoFinal === null ? (
              <span className="text-sm text-muted-foreground">digitando…</span>
            ) : (
              <p className="whitespace-pre-wrap">
                <TextoComLink texto={textoFinal} convite={convite} onAbrir={() => onAbrir(convite.token)} />
              </p>
            )}
            <p className="mt-1 text-right text-[11px] text-slate-500">{hora(convite.criadoEm)}</p>
          </div>
        )}

        {convite?.status === "CONFIRMADO" && (
          <div
            data-testid="bolha-cliente"
            className="max-w-[85%] self-end rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 text-[15px] shadow-sm"
          >
            <p>Confirmado ✓</p>
            <p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-slate-500">
              <CheckCheck className="size-3.5 text-sky-600" />
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
