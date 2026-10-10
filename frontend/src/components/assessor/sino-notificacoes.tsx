"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useNotificacoes } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useLidas } from "./tela-notificacoes";

/** Sino do cabeçalho do assessor com o número de notificações não lidas. */
export function SinoNotificacoes() {
  const q = useNotificacoes();
  const lidas = useLidas();
  const naoLidas = q.data?.notificacoes.filter((n) => !lidas.has(n.id)).length ?? 0;
  const rotulo = naoLidas ? `Notificações (${naoLidas} não lidas)` : "Notificações";
  return (
    <Link
      href="/assessor/notificacoes"
      aria-label={rotulo}
      title={rotulo}
      className="relative flex size-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    >
      <Bell className="size-5" />
      {naoLidas > 0 && (
        <span
          data-testid="contador-notificacoes"
          className={cn(
            "absolute -top-0.5 -right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-600 px-1",
            "text-[10px] font-bold text-white tabular-nums ring-2 ring-white",
          )}
        >
          {naoLidas > 99 ? "99+" : naoLidas}
        </span>
      )}
    </Link>
  );
}
