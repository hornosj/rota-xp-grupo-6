"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useNotificacoes } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useLidas } from "./tela-notificacoes";

/** Sino da barra preta do topo, com o número de notificações não lidas. */
export function SinoNotificacoes({ atual = false }: { atual?: boolean }) {
  const q = useNotificacoes();
  const lidas = useLidas();
  const naoLidas = q.data?.notificacoes.filter((n) => !lidas.has(n.id)).length ?? 0;
  const rotulo = naoLidas ? `Notificações (${naoLidas} não lidas)` : "Notificações";
  return (
    <Link
      href="/assessor/notificacoes"
      aria-label={rotulo}
      aria-current={atual ? "page" : undefined}
      title={rotulo}
      className={cn(
        "relative flex size-11 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white",
        atual && "bg-white text-black hover:bg-white hover:text-black",
      )}
    >
      <Bell className="size-[22px]" />
      {naoLidas > 0 && (
        <span
          data-testid="contador-notificacoes"
          className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs font-extrabold text-black ring-2 ring-black"
        >
          {naoLidas > 99 ? "99+" : naoLidas}
        </span>
      )}
    </Link>
  );
}
