import Link from "next/link";
import { Compass } from "lucide-react";

const linkNav = "rounded-md px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900";

export default function AssessorLayout({ children }: LayoutProps<"/assessor">) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-6 px-6">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
            <Compass className="size-5" /> Copiloto do Assessor
          </Link>
          <nav className="flex gap-1 text-sm">
            <Link href="/assessor" className={linkNav}>
              Painel
            </Link>
            <Link href="/assessor/hoje" className={linkNav}>
              Hoje
            </Link>
            <Link href="/assessor/convites" className={linkNav}>
              Cadastrar investidores
            </Link>
          </nav>
          <span className="ml-auto text-sm text-muted-foreground">Assessora · ass-001</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-6">{children}</main>
    </div>
  );
}
