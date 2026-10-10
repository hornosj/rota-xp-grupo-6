"use client";

import Link from "next/link";
import { Bell, Cake } from "lucide-react";
import { ehAniversarioHoje } from "@/lib/notificacoes";
import { useNotificacoes } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useLidas } from "./tela-notificacoes";

/** Botão de notificações da tela principal: alertas não lidos + aniversários próximos. */
export function BotaoNotificacoes({ className }: { className?: string }) {
  const q = useNotificacoes();
  const lidas = useLidas();
  const todas = q.data?.notificacoes ?? [];
  const naoLidas = todas.filter((n) => !lidas.has(n.id)).length;
  const alertas = todas.filter((n) => n.categoria !== "DATA_ESPECIAL" && !lidas.has(n.id)).length;
  const aniversarios = todas.filter((n) => n.aniversario != null);
  const hoje = aniversarios.filter(ehAniversarioHoje).length;
  return (
    <Link
      href="/assessor/notificacoes"
      data-testid="botao-notificacoes"
      className={cn(
        "inline-flex min-h-14 items-center gap-3.5 rounded-full border-2 border-black bg-white py-2 pr-7 pl-3 transition hover:bg-muted",
        className,
      )}
    >
      <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-black text-white">
        <Bell className="size-5" />
        {naoLidas > 0 && (
          <span
            data-testid="contador-notificacoes"
            className="absolute -top-1 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs font-extrabold text-black ring-2 ring-black"
          >
            {naoLidas > 99 ? "99+" : naoLidas}
          </span>
        )}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-base font-bold">Notificações</span>
        <span className="text-sm text-[#333]">
          {!q.data
            ? "Alertas e aniversários"
            : alertas
              ? `${alertas} alerta${alertas === 1 ? "" : "s"} não lido${alertas === 1 ? "" : "s"}`
              : "Nenhum alerta pendente"}
          {aniversarios.length > 0 && (
            <span data-testid="resumo-aniversarios" className="inline-flex items-center gap-1 font-bold text-black">
              <span aria-hidden className="mx-1.5 font-normal text-muted-foreground">
                ·
              </span>
              <Cake className="size-3.5" />
              {hoje > 0
                ? `${hoje} aniversário${hoje === 1 ? "" : "s"} hoje`
                : `${aniversarios.length} aniversário${aniversarios.length === 1 ? "" : "s"} esta semana`}
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}
