import Link from "next/link";
import { LayoutDashboard, ListOrdered, MonitorPlay, Newspaper, UserRound } from "lucide-react";
import { USE_MOCKS } from "@/lib/config";

const ANCORAS = [
  { id: "cli-001", nome: "Dra. Marina Costa", caso: "Estrela da demo: Aurora é principal; Horizonte oculto acima do FGC" },
  { id: "cli-002", nome: "Carlos Andrade", caso: "XP principal; CDB vencendo e consentimento expirando" },
  { id: "cli-003", nome: "Juliana Prado", caso: "Saldo parado, reserva curta, cartão não conectado" },
  { id: "cli-004", nome: "Patrícia Gomes", caso: "FGC por conglomerado (Aurora + Aurora Financeira)" },
  { id: "cli-005", nome: "Roberto Lima", caso: "Exposição sem garantia alta (CRA Agro Sul)" },
  { id: "cli-006", nome: "Lucas Ferreira", caso: "Caso controle: XP principal, sem alertas" },
];

export function Lancador() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <header>
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Hackathon · Grupo 6</p>
        <h1 className="mt-1 text-4xl font-bold tracking-tight">Copiloto do Assessor</h1>
        <p className="mt-2 max-w-2xl text-lg text-slate-600">
          Open Finance vira principalidade, e principalidade vira motivos para ligar. Dados 100% fictícios.
        </p>
        {USE_MOCKS && (
          <p className="mt-3 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
            Modo mock ativo (NEXT_PUBLIC_USE_MOCKS=true)
          </p>
        )}
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/palco" className="group rounded-2xl bg-slate-900 p-6 text-white shadow-lg transition hover:bg-slate-800">
          <MonitorPlay className="size-7" />
          <p className="mt-3 text-xl font-semibold">Palco da demo</p>
          <p className="mt-1 text-sm text-slate-300">Assessora e o convite no WhatsApp da cliente lado a lado</p>
        </Link>
        <Link href="/assessor/hoje" className="rounded-2xl border bg-card p-6 transition hover:border-slate-400">
          <ListOrdered className="size-7" />
          <p className="mt-3 text-xl font-semibold">Fila Hoje</p>
          <p className="mt-1 text-sm text-muted-foreground">Motivos para ligar em ordem de prioridade</p>
        </Link>
        <Link href="/assessor" className="rounded-2xl border bg-card p-6 transition hover:border-slate-400">
          <LayoutDashboard className="size-7" />
          <p className="mt-3 text-xl font-semibold">Painel da carteira</p>
          <p className="mt-1 text-sm text-muted-foreground">Onde a XP está na vida dos clientes</p>
        </Link>
        <Link href="/assessor/radar" className="rounded-2xl border bg-card p-6 transition hover:border-slate-400">
          <Newspaper className="size-7" />
          <p className="mt-3 text-xl font-semibold">Radar de notícias</p>
          <p className="mt-1 text-sm text-muted-foreground">Notícias que mexem na carteira de cada cliente</p>
        </Link>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Clientes-âncora</h2>
        <ul className="divide-y rounded-2xl border bg-card">
          {ANCORAS.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {c.nome} <span className="text-xs font-normal text-muted-foreground">{c.id}</span>
                </p>
                <p className="text-sm text-muted-foreground">{c.caso}</p>
              </div>
              <Link
                href={`/assessor/clientes/${c.id}`}
                className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                <UserRound className="size-4" /> Visão 360
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
