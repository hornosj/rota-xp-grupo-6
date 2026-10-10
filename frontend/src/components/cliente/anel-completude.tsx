import { cn } from "@/lib/utils";

/** Anel de completude do patrimônio visível (0–1). */
export function AnelCompletude({ completude, className }: { completude: number; className?: string }) {
  const p = Math.round(Math.max(0, Math.min(1, completude)) * 100);
  const raio = 52;
  const circ = 2 * Math.PI * raio;
  const completo = p >= 100;
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={p}
        aria-label="Patrimônio visível"
        className="relative size-40"
      >
        <svg viewBox="0 0 120 120" className="size-full -rotate-90">
          <circle cx="60" cy="60" r={raio} fill="none" strokeWidth="10" className="stroke-slate-200" />
          <circle
            cx="60"
            cy="60"
            r={raio}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - p / 100)}
            className={cn("transition-[stroke-dashoffset] duration-1000 ease-out", completo ? "stroke-emerald-500" : "stroke-slate-900")}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span data-testid="anel-percentual" className={cn("text-4xl font-bold tabular-nums", completo && "text-emerald-600")}>
            {p}%
          </span>
          <span className="text-xs text-muted-foreground">visível</span>
        </div>
      </div>
      <p className="mt-2 text-center text-sm font-medium">Seu patrimônio: {p}% visível</p>
    </div>
  );
}
