export function IndicadorAoVivo({ atualizando }: { atualizando?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ring-2 ring-black">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-black opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-black" />
      </span>
      Ao vivo{atualizando ? " · atualizando" : ""}
    </span>
  );
}
