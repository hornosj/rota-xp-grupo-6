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
      className={cn(
        "inline-flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-xs transition hover:border-slate-400",
        className,
      )}
    >
      <span className="relative">
        <Bell className="size-6" />
        {naoLidas > 0 && (
          <span
            data-testid="contador-notificacoes"
            className="absolute -top-1.5 -right-2 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white tabular-nums ring-2 ring-white"
          >
            {naoLidas > 99 ? "99+" : naoLidas}
          </span>
        )}
      </span>
      <span className="text-left leading-tight">
        <span className="block font-semibold">Notificações</span>
        <span className="block text-xs text-muted-foreground">
          {!q.data
            ? "Alertas e aniversários"
            : alertas
              ? `${alertas} alerta${alertas === 1 ? "" : "s"} não lido${alertas === 1 ? "" : "s"}`
              : "Nenhum alerta pendente"}
        </span>
        {aniversarios.length > 0 && (
          <span data-testid="resumo-aniversarios" className="mt-0.5 flex items-center gap-1 text-xs font-medium text-violet-700">
            <Cake className="size-3.5" />
            {hoje > 0
              ? `${hoje} aniversário${hoje === 1 ? "" : "s"} hoje`
              : `${aniversarios.length} aniversário${aniversarios.length === 1 ? "" : "s"} esta semana`}
          </span>
        )}
      </span>
    </Link>
  );
}
