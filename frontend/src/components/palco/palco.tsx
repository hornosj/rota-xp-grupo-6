"use client";

import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { MolduraCelular } from "@/components/cliente/moldura-celular";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { USE_MOCKS } from "@/lib/config";
import { useResetDemo } from "@/lib/queries";

const ABAS = {
  hoje: { rotulo: "Fila Hoje", src: "/assessor/hoje?aoVivo=1" },
  marina: { rotulo: "360 da Marina", src: "/assessor/clientes/cli-001?aoVivo=1" },
  painel: { rotulo: "Painel da carteira", src: "/assessor?aoVivo=1" },
} as const;
type Aba = keyof typeof ABAS;

export function Palco() {
  const [aba, setAba] = useState<Aba>("hoje");
  const [versao, setVersao] = useState(0);
  const reset = useResetDemo();

  async function resetar() {
    try {
      await reset.mutateAsync();
      setAba("hoje");
      setVersao((v) => v + 1);
      toast.success("Demo resetada");
    } catch (e) {
      toast.error(`Falha ao resetar: ${e instanceof Error ? e.message : "erro"}`);
    }
  }

  return (
    <div className="flex h-screen min-h-[720px] flex-col bg-slate-100">
      <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-white px-6">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold tracking-tight">Copiloto do Assessor</span>
          <span className="text-sm text-muted-foreground">Open Finance → principalidade → motivos para ligar</span>
        </div>
        {USE_MOCKS && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">modo mock</span>
        )}
        <div className="ml-auto">
          <Button variant="outline" size="lg" onClick={resetar} disabled={reset.isPending}>
            {reset.isPending ? <Loader2 className="animate-spin" /> : <RotateCcw />} Resetar demo
          </Button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 gap-6 p-6">
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b px-4 py-2">
            <span className="text-sm font-semibold text-muted-foreground">Assessora</span>
            <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)}>
              <TabsList>
                {(Object.keys(ABAS) as Aba[]).map((k) => (
                  <TabsTrigger key={k} value={k} className="px-3">
                    {ABAS[k].rotulo}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <iframe
            key={`assessor-${versao}-${aba}`}
            title="Tela do assessor"
            src={ABAS[aba].src}
            className="min-h-0 w-full flex-1 border-0"
          />
        </section>

        <section className="flex shrink-0 flex-col items-center justify-center gap-3">
          <span className="text-sm font-semibold text-muted-foreground">Celular da Marina</span>
          <MolduraCelular>
            <iframe key={`cliente-${versao}`} title="Celular da cliente" src="/cliente/cli-001" className="size-full border-0" />
          </MolduraCelular>
        </section>
      </main>
    </div>
  );
}
