// Formatação pt-BR. Dinheiro chega em reais (number); percentuais como fração 0–1.

const fmtBrl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtBrlInteiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/** R$ 1.234,56 (ou sem centavos com `inteiro`). */
export function brl(valor: number | null | undefined, opts?: { inteiro?: boolean }): string {
  if (valor == null || Number.isNaN(valor)) return "—";
  return (opts?.inteiro ? fmtBrlInteiro : fmtBrl).format(valor);
}

/** Forma curta para títulos: R$ 61 mil, R$ 1,6 mi. */
export function brlCurto(valor: number | null | undefined): string {
  if (valor == null || Number.isNaN(valor)) return "—";
  const abs = Math.abs(valor);
  const sinal = valor < 0 ? "-" : "";
  const num = (n: number, casas: number) =>
    n.toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: 0 });
  if (abs >= 1_000_000) return `${sinal}R$ ${num(abs / 1_000_000, 1)} mi`;
  if (abs >= 1_000) return `${sinal}R$ ${num(abs / 1_000, abs >= 100_000 ? 0 : 1)} mil`;
  return brl(valor, { inteiro: true });
}

/** Fração 0–1 → "67%". */
export function pct(fracao: number | null | undefined, casas = 0): string {
  if (fracao == null || Number.isNaN(fracao)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    maximumFractionDigits: casas,
    minimumFractionDigits: casas,
  }).format(fracao);
}

/** Número com casas decimais em pt-BR (ex.: 6,5). */
export function numero(valor: number | null | undefined, casas = 1): string {
  if (valor == null || Number.isNaN(valor)) return "—";
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: 0 });
}

function parseIsoData(iso: string): Date {
  // 'YYYY-MM-DD' vira data local (sem fuso); com hora, usa o parser padrão.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(iso);
}

/** ISO → "16/10/2026". */
export function data(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parseIsoData(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}

/** ISO com hora → "11/10/2026 14:32". */
export function dataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function inicioDoDia(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Dias inteiros de `referencia` (padrão: hoje) até `iso`. Negativo se já passou. */
export function diasAte(iso: string, referencia?: string | Date): number {
  const alvo = parseIsoData(iso);
  const ref = referencia ? (typeof referencia === "string" ? parseIsoData(referencia) : referencia) : new Date();
  return Math.round((inicioDoDia(alvo) - inicioDoDia(ref)) / 86_400_000);
}

/** Próximo aniversário (ISO) de uma data de nascimento, a partir da referência. */
export function proximoAniversario(nascimentoIso: string, referencia?: string | Date): string {
  const nasc = parseIsoData(nascimentoIso);
  const ref = referencia ? (typeof referencia === "string" ? parseIsoData(referencia) : referencia) : new Date();
  let alvo = new Date(ref.getFullYear(), nasc.getMonth(), nasc.getDate());
  if (inicioDoDia(alvo) < inicioDoDia(ref)) alvo = new Date(ref.getFullYear() + 1, nasc.getMonth(), nasc.getDate());
  const mm = String(alvo.getMonth() + 1).padStart(2, "0");
  const dd = String(alvo.getDate()).padStart(2, "0");
  return `${alvo.getFullYear()}-${mm}-${dd}`;
}

/** "em 5 dias", "hoje", "amanhã", "há 3 dias". */
export function emDias(dias: number): string {
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias === -1) return "ontem";
  if (dias > 1) return `em ${dias} dias`;
  return `há ${-dias} dias`;
}

export function primeiroNome(nome: string): string {
  const partes = nome.replace(/^(Dra?\.|Sr\.|Sra\.)\s+/i, "").split(" ");
  return partes[0] ?? nome;
}
