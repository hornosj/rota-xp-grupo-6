"use client";

import { useState } from "react";
import { CheckCircle2, Clock, Link2, Link2Off, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-base";
import type { AcaoSugerida, Convite, Id, Visao360 } from "@/lib/api-types";
import { pct } from "@/lib/formato";
import { useConvites, useCriarConvite } from "@/lib/queries";
import { rotuloProdutoDeclarado } from "@/lib/rotulos";
import { DialogMensagem } from "./dialog-mensagem";

/** Id da ação CONVIDAR_CONEXAO no backend: acao-{clienteId}-convidar_conexao-{instituicaoId}. */
export function idAcaoConvidar(clienteId: Id, instituicaoId: Id): Id {
  return `acao-${clienteId}-convidar_conexao-${instituicaoId}`;
}

/** "13/10 14:01" */
function diaHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dia = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dia} ${hora}`;
}

/** O convite mais recente de cada instituição. */
function ultimosPorInstituicao(convites: Convite[]): Map<Id, Convite> {
  const m = new Map<Id, Convite>();
  for (const c of convites) {
    const atual = m.get(c.instituicaoId);
    if (!atual || new Date(c.criadoEm).getTime() >= new Date(atual.criadoEm).getTime()) m.set(c.instituicaoId, c);
  }
  return m;
}

function StatusConvite({ convite, comNome }: { convite: Convite; comNome?: boolean }) {
  const nome = comNome ? `${convite.instituicaoNome} · ` : "";
  if (convite.status === "CONFIRMADO") {
    return (
      <span data-testid="status-convite" className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="size-3.5" /> {nome}Confirmado
      </span>
    );
  }
  if (convite.status === "EXPIRADO") {
    return (
      <span data-testid="status-convite" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="size-3.5" /> {nome}Convite expirado
      </span>
    );
  }
  return (
    <span data-testid="status-convite" className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
      <Clock className="size-3.5" /> {nome}Convite pendente · expira em {diaHora(convite.expiraEm)}
    </span>
  );
}

export function CoberturaConvites({ visao, aoVivo }: { visao: Visao360; aoVivo?: boolean }) {
  const { cliente, cobertura } = visao;
  const completo = cobertura.pendentes.length === 0;
  const convites = useConvites(cliente.id, { aoVivo });
  const criar = useCriarConvite();
  const [acaoAberta, setAcaoAberta] = useState<AcaoSugerida | null>(null);
  const [enviando, setEnviando] = useState<Id | null>(null);

  const ultimos = ultimosPorInstituicao(convites.data ?? []);
  const pendentesIds = new Set(cobertura.pendentes.map((p) => p.instituicaoId));
  const confirmados = [...ultimos.values()].filter((c) => c.status === "CONFIRMADO" && !pendentesIds.has(c.instituicaoId));

  async function enviar(instituicaoId: Id, nome: string) {
    setEnviando(instituicaoId);
    try {
      await criar.mutateAsync({ clienteId: cliente.id, instituicaoId });
      const id = idAcaoConvidar(cliente.id, instituicaoId);
      const acao: AcaoSugerida = visao.acoes.find((a) => a.id === id) ?? {
        id,
        clienteId: cliente.id,
        tipo: "CONVIDAR_CONEXAO",
        titulo: `Convidar a conectar o ${nome}`,
        motivo: `${nome} ainda não está conectado.`,
        alertaIds: [],
        principal: false,
      };
      setAcaoAberta(acao);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.info(`${nome} já está conectado`);
      } else {
        toast.error(`Não foi possível criar o convite: ${e instanceof Error ? e.message : "erro"}`);
      }
    } finally {
      setEnviando(null);
    }
  }

  return (
    <div data-testid="cobertura" className="min-w-64 rounded-lg bg-slate-50 p-3">
      <div className="flex items-center gap-2">
        {completo ? <Link2 className="size-4 text-emerald-600" /> : <Link2Off className="size-4 text-amber-600" />}
        <span className="font-semibold">
          {cobertura.instituicoesConectadas} de {cobertura.instituicoesDeclaradas} instituições conectadas
        </span>
        <span className="ml-auto text-sm font-bold tabular-nums">{pct(cobertura.percentual)}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className={completo ? "h-full bg-emerald-500 transition-all duration-700" : "h-full bg-amber-500 transition-all duration-700"}
          style={{ width: `${Math.round(cobertura.percentual * 100)}%` }}
        />
      </div>
      {cobertura.pendentes.length > 0 && (
        <ul className="mt-2 flex flex-col gap-2 text-sm text-slate-700">
          {cobertura.pendentes.map((p) => {
            const convite = ultimos.get(p.instituicaoId);
            return (
              <li key={p.instituicaoId} data-testid={`pendente-cobertura-${p.instituicaoId}`} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <div className="min-w-0 flex-1">
                  <p>
                    Pendente: <span className="font-medium">{p.nome}</span>{" "}
                    <span className="text-muted-foreground">({p.produtos.map((x) => rotuloProdutoDeclarado[x]).join(", ")})</span>
                  </p>
                  {convite && <StatusConvite convite={convite} />}
                </div>
                <Button size="sm" onClick={() => enviar(p.instituicaoId, p.nome)} disabled={enviando !== null}>
                  {enviando === p.instituicaoId ? <Loader2 className="animate-spin" /> : <Send />} Enviar convite
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {confirmados.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {confirmados.map((c) => (
            <li key={c.token}>
              <StatusConvite convite={c} comNome />
            </li>
          ))}
        </ul>
      )}
      {acaoAberta && (
        <DialogMensagem
          clienteId={cliente.id}
          acao={acaoAberta}
          open
          onOpenChange={(o) => {
            if (!o) setAcaoAberta(null);
          }}
        />
      )}
    </div>
  );
}
