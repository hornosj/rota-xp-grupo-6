"use client";

import { useState } from "react";
import { Check, Clock, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-base";
import type { AcaoSugerida, Convite, Id, Visao360 } from "@/lib/api-types";
import { useConvites, useCriarConvite } from "@/lib/queries";
import { rotuloProdutoDeclarado } from "@/lib/rotulos";
import { cn } from "@/lib/utils";
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

const chip = "inline-flex items-center gap-1 self-start rounded-full px-2.5 py-0.5 text-[13px] font-bold";

/** Confirmado preenchido de preto, pendente contornado, expirado em cinza. */
function StatusConvite({ convite, comNome }: { convite: Convite; comNome?: boolean }) {
  const nome = comNome ? `${convite.instituicaoNome} · ` : "";
  if (convite.status === "CONFIRMADO") {
    return (
      <span data-testid="status-convite" className={cn(chip, "bg-black text-white")}>
        <Check className="size-3.5" /> {nome}Confirmado
      </span>
    );
  }
  if (convite.status === "EXPIRADO") {
    return (
      <span data-testid="status-convite" className={cn(chip, "bg-muted font-semibold text-muted-foreground")}>
        <Clock className="size-3.5" /> {nome}Convite expirado
      </span>
    );
  }
  return (
    <span data-testid="status-convite" className={cn(chip, "ring-1 ring-black")}>
      <Clock className="size-3.5" /> {nome}Convite pendente · expira em {diaHora(convite.expiraEm)}
    </span>
  );
}

/** Instituições pendentes com o botão de convite e o status de cada convite enviado. */
export function CoberturaConvites({ visao, aoVivo }: { visao: Visao360; aoVivo?: boolean }) {
  const { cliente, cobertura } = visao;
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

  if (!cobertura.pendentes.length && !confirmados.length) return null;

  return (
    <>
      {cobertura.pendentes.length > 0 && (
        <ul className="flex flex-col gap-3 text-[15px]">
          {cobertura.pendentes.map((p) => {
            const convite = ultimos.get(p.instituicaoId);
            return (
              <li
                key={p.instituicaoId}
                data-testid={`pendente-cobertura-${p.instituicaoId}`}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
              >
                <div className="flex min-w-0 flex-col gap-1.5">
                  <p>
                    Pendente: <span className="font-bold">{p.nome}</span>{" "}
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
        <ul className="flex flex-wrap gap-2">
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
          nomeCliente={cliente.nome}
          acao={acaoAberta}
          open
          onOpenChange={(o) => {
            if (!o) setAcaoAberta(null);
          }}
        />
      )}
    </>
  );
}
