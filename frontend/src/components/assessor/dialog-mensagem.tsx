"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Check, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { BadgeGeradoPor, Sobretitulo } from "@/components/comum/marcadores";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { AcaoSugerida, Canal, Id } from "@/lib/api-types";
import { useMensagem } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function linkWhatsApp(texto: string) {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}

interface Props {
  clienteId: Id;
  nomeCliente?: string;
  acao: AcaoSugerida;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DialogMensagem({ clienteId, nomeCliente, acao, open, onOpenChange }: Props) {
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
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-4xl">
        <div className="grid md:grid-cols-[minmax(0,1fr)_400px]">
          <div className="flex flex-col gap-6 p-6 sm:p-9">
            <DialogHeader className="gap-2 pr-10">
              <Sobretitulo>Mensagem para</Sobretitulo>
              <DialogTitle className="text-3xl leading-tight font-extrabold tracking-tight">
                {nomeCliente ?? "o cliente"}
              </DialogTitle>
              <DialogDescription className="text-[17px] text-muted-foreground">{acao.titulo}</DialogDescription>
            </DialogHeader>

            <div className="inline-flex self-start rounded-full border-2 border-black p-[3px]" role="group" aria-label="Canal">
              {(["WHATSAPP", "EMAIL"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={canal === c}
                  onClick={() => setCanal(c)}
                  className={cn(
                    "h-10 rounded-full px-5 text-[15px] font-semibold transition",
                    canal === c ? "bg-black font-bold text-white" : "hover:bg-muted",
                  )}
                >
                  {c === "WHATSAPP" ? "WhatsApp" : "E-mail"}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <Sobretitulo className="text-[13px]">Por que agora</Sobretitulo>
              <p className="text-[17px] leading-relaxed">{acao.motivo}</p>
              <p className="text-[15px] text-muted-foreground">Todos os números vêm da análise. A IA só redige o texto.</p>
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-3">
              {canal === "WHATSAPP" && (
                <a
                  href={linkWhatsApp(texto)}
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={!texto}
                  className={cn(buttonVariants({ size: "lg" }), !texto && "pointer-events-none opacity-50")}
                >
                  Abrir no WhatsApp <ArrowUpRight />
                </a>
              )}
              <Button variant="outline" size="lg" onClick={copiar} disabled={!texto}>
                {copiado ? <Check /> : <Copy />} Copiar
              </Button>
              <Button
                variant="ghost"
                size="lg"
                onClick={() => mutate({ clienteId, acaoId: acao.id, canal })}
                disabled={isPending}
              >
                <RefreshCw /> Gerar de novo
              </Button>
            </div>
          </div>

          <div className="flex flex-col justify-center gap-3 bg-muted p-6 sm:p-8">
            <p className="text-center text-[13px] font-bold tracking-[0.08em] uppercase">Prévia</p>
            {isPending && (
              <div className="flex flex-col gap-2 rounded-2xl bg-white p-4" aria-label="Gerando mensagem">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            )}
            {isError && (
              <p className="rounded-2xl border-2 border-black bg-white p-4 text-base">
                Não foi possível gerar a mensagem. {error instanceof Error ? error.message : ""}
              </p>
            )}
            {data && !isPending && (
              <>
                <div
                  data-testid="texto-mensagem"
                  className="rounded-2xl rounded-br-sm border border-[#bdbdbd] bg-white p-4 text-[17px] leading-relaxed whitespace-pre-wrap"
                >
                  {texto}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <BadgeGeradoPor geradoPor={data.geradoPor} />
                  <span className="text-muted-foreground">{texto.length} caracteres</span>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
