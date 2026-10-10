import { cn } from "@/lib/utils";
import type { GeradoPor, PerfilInvestidor, PosicaoXp, Severidade } from "@/lib/api-types";
import { rotuloPerfil, rotuloPosicaoXp, rotuloSeveridade } from "@/lib/rotulos";

const base = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

const corPosicao: Record<PosicaoXp, string> = {
  PRINCIPAL: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
  SECUNDARIA: "bg-sky-100 text-sky-800 ring-1 ring-sky-200",
  SO_INVESTIMENTOS: "bg-amber-100 text-amber-900 ring-1 ring-amber-200",
  AUSENTE: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
};

export function BadgePosicaoXp({ posicao, className }: { posicao: PosicaoXp; className?: string }) {
  return <span className={cn(base, corPosicao[posicao], className)}>{rotuloPosicaoXp[posicao]}</span>;
}

export function ChipPerfil({ perfil, className }: { perfil: PerfilInvestidor; className?: string }) {
  return <span className={cn(base, "bg-slate-100 text-slate-700", className)}>{rotuloPerfil[perfil]}</span>;
}

/** Vermelho só para ALTA. */
export const corSeveridade: Record<Severidade, { borda: string; chip: string; barra: string }> = {
  ALTA: { borda: "border-red-300 bg-red-50/60", chip: "bg-red-600 text-white", barra: "bg-red-600" },
  MEDIA: { borda: "border-amber-200 bg-amber-50/50", chip: "bg-amber-100 text-amber-900", barra: "bg-amber-500" },
  BAIXA: { borda: "border-slate-200 bg-white", chip: "bg-slate-100 text-slate-700", barra: "bg-slate-400" },
};

export function ChipSeveridade({ severidade }: { severidade: Severidade }) {
  return <span className={cn(base, corSeveridade[severidade].chip)}>{rotuloSeveridade[severidade]}</span>;
}

/** Tag NOVO pulsante. */
export function TagNovo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        base,
        "animate-novo bg-blue-600 text-[10px] font-bold tracking-wider text-white shadow-[0_0_0_3px_rgba(37,99,235,0.25)]",
        className,
      )}
    >
      NOVO
    </span>
  );
}

const rotuloGerado: Record<GeradoPor, string> = {
  stub: "stub (modelo)",
  cache: "cache (IA gravada)",
  live: "live (IA ao vivo)",
};

export function BadgeGeradoPor({ geradoPor }: { geradoPor: GeradoPor }) {
  return (
    <span data-testid="gerado-por" className={cn(base, "bg-violet-100 text-violet-800 ring-1 ring-violet-200")}>
      gerado por {rotuloGerado[geradoPor] ?? geradoPor}
    </span>
  );
}

export function Vazio({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground", className)}>
      {children}
    </div>
  );
}

export function ErroCarregar({ erro, className }: { erro: unknown; className?: string }) {
  const msg = erro instanceof Error ? erro.message : "Erro inesperado";
  return (
    <div className={cn("rounded-lg border border-slate-300 bg-slate-50 p-6 text-sm text-slate-700", className)}>
      <p className="font-medium">Não foi possível carregar os dados.</p>
      <p className="mt-1 text-muted-foreground">{msg}</p>
    </div>
  );
}
