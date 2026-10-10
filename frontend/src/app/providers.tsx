"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiError } from "@/lib/api-base";
import { SincronizarDados } from "@/lib/sinal";

function criarQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000,
        refetchOnWindowFocus: false,
        // 404 não melhora tentando de novo; outros erros: 1 nova tentativa.
        retry: (falhas, erro) => !(erro instanceof ApiError && erro.status === 404) && falhas < 1,
      },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(criarQueryClient);
  return (
    <QueryClientProvider client={qc}>
      <SincronizarDados />
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster theme="light" position="top-center" richColors />
    </QueryClientProvider>
  );
}
