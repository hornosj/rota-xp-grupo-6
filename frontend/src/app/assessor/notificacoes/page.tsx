import { Suspense } from "react";
import { EsqueletoNotificacoes, TelaNotificacoes } from "@/components/assessor/tela-notificacoes";

export default function NotificacoesPage() {
  return (
    <Suspense fallback={<EsqueletoNotificacoes />}>
      <TelaNotificacoes />
    </Suspense>
  );
}
