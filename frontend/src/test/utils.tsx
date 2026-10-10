import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SincronizarDados } from "@/lib/sinal";

export function renderComQuery(ui: ReactElement, opts?: RenderOptions) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <SincronizarDados />
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  );
  return { qc, ...render(ui, { wrapper: Wrapper, ...opts }) };
}
