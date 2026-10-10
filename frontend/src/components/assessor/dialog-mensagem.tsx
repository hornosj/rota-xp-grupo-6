"use client";

import { useEffect, useState } from "react";
import { Check, Copy, MessageCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { BadgeGeradoPor } from "@/components/comum/marcadores";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { AcaoSugerida, Canal, Id } from "@/lib/api-types";
import { useMensagem } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function linkWhatsApp(texto: string) {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}

interface Props {
  clienteId: Id;
  acao: AcaoSugerida;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DialogMensagem({ clienteId, acao, open, onOpenChange }: Props) {
  const [canal, setCanal] = useState<Canal>("WHATSAPP");
  const [copiado, setCopiado] = useState(false);
  const { mutate, data, isPending, isError, error, reset } = useMensagem();

  useEffect(() => {
    if (open) mutate({ clienteId, acaoId: acao.id, canal });
  }, [open, canal, clienteId, acao.id, mutate]);

  const texto = data?.texto ?? "";

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      toast.success("Mensagem copiada");
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-lg">Mensagem para o cliente</DialogTitle>
          <DialogDescription>{acao.titulo}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
          {(["WHATSAPP", "EMAIL"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCanal(c)}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 font-medium transition",
                canal === c ? "bg-background shadow-sm" : "text-muted-foreground",
              )}
            >
              {c === "WHATSAPP" ? "WhatsApp" : "E-mail"}
            </button>
          ))}
        </div>

        {isPending && (
          <div className="flex flex-col gap-2" aria-label="Gerando mensagem">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}
        {isError && (
          <p className="rounded-md bg-slate-100 p-3 text-sm">
            Não foi possível gerar a mensagem. {error instanceof Error ? error.message : ""}
          </p>
        )}
        {data && !isPending && (
          <div className="flex flex-col gap-2">
            <div
              data-testid="texto-mensagem"
              className="rounded-lg border bg-emerald-50/40 p-4 text-[15px] leading-relaxed whitespace-pre-wrap"
            >
              {texto}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <BadgeGeradoPor geradoPor={data.geradoPor} />
              <span>{texto.length} caracteres</span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => mutate({ clienteId, acaoId: acao.id, canal })}
            disabled={isPending}
          >
            <RefreshCw /> Gerar de novo
          </Button>
          <Button variant="outline" onClick={copiar} disabled={!texto}>
            {copiado ? <Check /> : <Copy />} Copiar
          </Button>
          {canal === "WHATSAPP" && (
            <a
              href={linkWhatsApp(texto)}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!texto}
              className={cn(
                buttonVariants(),
                "bg-emerald-600 text-white hover:bg-emerald-700",
                !texto && "pointer-events-none opacity-50",
              )}
            >
              <MessageCircle /> Abrir no WhatsApp
            </a>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
