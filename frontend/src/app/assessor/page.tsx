import { Suspense } from "react";
import { TelaPainel } from "@/components/assessor/tela-painel";
import { Skeleton } from "@/components/ui/skeleton";

export default function PainelPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <TelaPainel />
    </Suspense>
  );
}
