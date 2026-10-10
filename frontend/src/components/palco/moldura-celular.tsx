import { cn } from "@/lib/utils";

/** Moldura de celular (390×844) para o /palco. */
export function MolduraCelular({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative rounded-[3rem] bg-slate-900 p-3 shadow-2xl ring-1 ring-slate-700", className)}>
      <div className="absolute top-3 left-1/2 z-10 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-slate-900" aria-hidden />
      <div className="h-[844px] w-[390px] overflow-hidden rounded-[2.3rem] bg-white">{children}</div>
    </div>
  );
}
