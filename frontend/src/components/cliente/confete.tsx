const CORES = ["#10b981", "#0ea5e9", "#f59e0b", "#ec4899", "#8b5cf6", "#22c55e"];

/** Confete em CSS puro (sem dependências), determinístico. */
export function Confete({ pecas = 40 }: { pecas?: number }) {
  return (
    <div data-testid="confete" className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: pecas }, (_, i) => {
        const esquerda = (i * 37) % 100;
        const atraso = ((i * 53) % 60) / 100;
        const duracao = 1.6 + ((i * 29) % 12) / 10;
        const tamanho = 6 + ((i * 7) % 6);
        const giro = (i * 47) % 360;
        return (
          <span
            key={i}
            className="animate-confete absolute -top-4 block rounded-[2px]"
            style={{
              left: `${esquerda}%`,
              width: tamanho,
              height: tamanho * 0.45,
              backgroundColor: CORES[i % CORES.length],
              animationDelay: `${atraso}s`,
              animationDuration: `${duracao}s`,
              transform: `rotate(${giro}deg)`,
            }}
          />
        );
      })}
    </div>
  );
}
