"use client";

import { useParams } from "next/navigation";
import { TelaCliente360 } from "./tela-cliente-360";

export function RotaCliente360() {
  const { id } = useParams<{ id: string }>();
  return <TelaCliente360 key={id} clienteId={id} />;
}
