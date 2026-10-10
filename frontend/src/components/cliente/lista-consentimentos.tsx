"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ErroCarregar, Vazio } from "@/components/comum/marcadores";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { ConsentimentoComNome, Id, StatusConsentimento } from "@/lib/api-types";
import { data } from "@/lib/formato";
import { useConsentimentos, useRevogar } from "@/lib/queries";
import { rotuloEscopo, rotuloStatusConsentimento } from "@/lib/rotulos";
import { cn } from "@/lib/utils";

const corStatus: Record<StatusConsentimento, string> = {
  ATIVO: "bg-emerald-100 text-emerald-800",
  PENDENTE: "bg-amber-100 text-amber-900",
  EXPIRADO: "bg-slate-200 text-slate-700",
  REVOGADO: "bg-slate-200 text-slate-700",
};

export function ListaConsentimentos({ clienteId }: { clienteId: Id }) {
  const consentimentos = useConsentimentos(clienteId);
  const revogar = useRevogar();
  const [alvo, setAlvo] = useState<ConsentimentoComNome | null>(null);

  if (consentimentos.isError) return <ErroCarregar erro={consentimentos.error} />;
  if (!consentimentos.data) {
    return (
      <div className="flex flex-col gap-3" aria-label="Carregando">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );
  }
  if (!consentimentos.data.length) return <Vazio>Nenhuma instituição conectada.</Vazio>;

  async function confirmarRevogacao() {
    if (!alvo) return;
    try {
      await revogar.mutateAsync({ clienteId, instituicaoId: alvo.instituicaoId });
      toast.success(`Compartilhamento com o ${alvo.instituicaoNome} revogado`);
    } catch {
      toast.error("Não foi possível revogar agora");
    } finally {
      setAlvo(null);
    }
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {consentimentos.data.map((c) => {
          const interno = c.tipo === "INTERNO";
          return (
            <li key={c.id} data-testid={`consentimento-${c.instituicaoId}`} className="rounded-2xl border bg-card p-4">
              <div className="flex items-center gap-2">
                <p className="font-semibold">{c.instituicaoNome}</p>
                <span className={cn("ml-auto rounded-full px-2 py-0.5 text-xs font-medium", corStatus[c.status])}>
                  {rotuloStatusConsentimento[c.status]}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {interno ? "Plataforma XP · dados próprios" : c.escopos.map((e) => rotuloEscopo[e]).join(" · ")}
              </p>
              {!interno && c.status === "ATIVO" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.concedidoEm && <>Desde {data(c.concedidoEm.slice(0, 10))} · </>}
                  {c.expiraEm && <>expira em {data(c.expiraEm.slice(0, 10))}</>}
                </p>
              )}
              {!interno && (
                <div className="mt-3">
                  {c.status === "ATIVO" ? (
                    <Button variant="outline" className="w-full" onClick={() => setAlvo(c)}>
                      Revogar compartilhamento
                    </Button>
                  ) : (
                    <Link
                      href={`/cliente/${clienteId}/conectar/${c.instituicaoId}`}
                      className={cn(buttonVariants(), "w-full")}
                    >
                      Conectar
                    </Link>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Dialog open={!!alvo} onOpenChange={(o) => !o && setAlvo(null)}>
        <DialogContent className="max-w-[340px]">
          <DialogHeader>
            <DialogTitle>Revogar o {alvo?.instituicaoNome}?</DialogTitle>
            <DialogDescription>
              A XP deixa de ver esses dados imediatamente. Alguns diagnósticos podem voltar a ficar bloqueados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAlvo(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarRevogacao} disabled={revogar.isPending}>
              Sim, revogar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
