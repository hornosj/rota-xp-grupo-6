// Central de notificações do assessor.
// PROVISÓRIO: o backend ainda não tem endpoint de notificações. Enquanto isso, montamos a lista no
// front a partir de GET /clientes + GET /clientes/{id}/360 (alertas, dependentes e eventos de vida).
// Quando existir algo como GET /assessor/notificacoes, troque `carregarNotificacoes` pela chamada
// e ajuste o tipo `Notificacao` ao contrato; a tela só depende deste arquivo.
import type { Api } from "./api-base";
import type { Alerta, Cliente, Id, Severidade, TipoAlerta } from "./api-types";
import { diasAte, primeiroNome, proximoAniversario } from "./formato";

/**
 * PROVISÓRIO: o contrato ainda não tem a data de nascimento do próprio cliente (só `idade`).
 * Lemos o campo se vier; quando entrar no contrato, mova para `Cliente` em api-types.ts.
 */
export type ClienteComNascimento = Cliente & { dataNascimento?: string };

/** De quem é o aniversário. */
export interface Aniversariante {
  de: "CLIENTE" | "DEPENDENTE";
  nome: string;
  parentesco?: string;
  idade: number;
}

export type CategoriaNotificacao = "RISCO" | "OPORTUNIDADE" | "OPEN_FINANCE" | "DATA_ESPECIAL";

export interface Notificacao {
  id: Id;
  clienteId: Id;
  clienteNome: string;
  categoria: CategoriaNotificacao;
  severidade: Severidade;
  titulo: string;
  descricao: string;
  valor?: number;
  /** Tipo do alerta de origem, quando vier de um alerta da análise. */
  tipoAlerta?: TipoAlerta;
  /** Quando a notificação surgiu (ISO com hora). */
  criadaEm: string;
  /** Data do evento (ISO 'YYYY-MM-DD') para datas especiais. */
  dataEvento?: string;
  /** Dias até `dataEvento` a partir da data de referência. */
  emDias?: number;
  /** Preenchido quando a data especial é um aniversário. */
  aniversario?: Aniversariante;
  /** Alerta recém-detectado pelo backend (janela de "NOVO"). */
  novo: boolean;
}

/** Janela das datas especiais que viram notificação (mesma do backend: alertas.evento-vida-dias). */
export const JANELA_NOTIFICACAO_DATAS = 7;
/** Janela do quadro "Próximas datas". */
export const JANELA_PROXIMAS_DATAS = 30;

export const categoriaPorTipoAlerta: Record<TipoAlerta, CategoriaNotificacao> = {
  FGC_EXCEDIDO: "RISCO",
  FGC_TETO_GLOBAL: "RISCO",
  CONCENTRACAO_EMISSOR: "RISCO",
  RESERVA_INSUFICIENTE: "RISCO",
  SALDO_PARADO: "OPORTUNIDADE",
  RENDA_FORA_XP: "OPORTUNIDADE",
  VENCIMENTO_PROXIMO: "OPORTUNIDADE",
  CONSENTIMENTO_EXPIRANDO: "OPEN_FINANCE",
  EVENTO_VIDA_PROXIMO: "DATA_ESPECIAL",
};

export const rotuloCategoria: Record<CategoriaNotificacao, string> = {
  RISCO: "Riscos",
  OPORTUNIDADE: "Oportunidades",
  OPEN_FINANCE: "Open Finance",
  DATA_ESPECIAL: "Datas especiais",
};

export interface DataEspecial {
  id: Id;
  clienteId: Id;
  clienteNome: string;
  titulo: string;
  data: string;
  emDias: number;
  aniversario?: Aniversariante;
}

export interface ResultadoNotificacoes {
  notificacoes: Notificacao[];
  /** Datas especiais da carteira em até JANELA_PROXIMAS_DATAS dias. */
  proximasDatas: DataEspecial[];
  dataReferencia?: string;
}

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

function deAlerta(a: Alerta, clienteNome: string): Notificacao {
  return {
    id: a.id,
    clienteId: a.clienteId,
    clienteNome,
    categoria: categoriaPorTipoAlerta[a.tipo] ?? "RISCO",
    severidade: a.severidade,
    titulo: a.titulo,
    descricao: a.explicacao,
    valor: a.valor,
    tipoAlerta: a.tipo,
    criadaEm: a.detectadoEm,
    novo: a.novo,
  };
}

/** Aniversários de dependentes + eventos de vida futuros (sem duplicar o aniversário já cadastrado como evento). */
export function datasEspeciais(cliente: ClienteComNascimento, dataReferencia?: string): DataEspecial[] {
  const deps = cliente.dependentes ?? [];
  const doCliente: DataEspecial[] = [];
  if (cliente.dataNascimento) {
    const prox = proximoAniversario(cliente.dataNascimento, dataReferencia);
    const idade = Number(prox.slice(0, 4)) - Number(cliente.dataNascimento.slice(0, 4));
    doCliente.push({
      id: `aniv-${cliente.id}-${prox.slice(0, 4)}`,
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      titulo: `Aniversário de ${primeiroNome(cliente.nome)} (${idade} anos)`,
      data: prox,
      emDias: diasAte(prox, dataReferencia),
      aniversario: { de: "CLIENTE", nome: cliente.nome, idade },
    });
  }
  const aniversarios = deps.map((d): DataEspecial => {
    const prox = proximoAniversario(d.dataNascimento, dataReferencia);
    const idade = Number(prox.slice(0, 4)) - Number(d.dataNascimento.slice(0, 4));
    return {
      id: `aniv-${cliente.id}-${slug(d.nome)}-${prox.slice(0, 4)}`,
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      titulo: `Aniversário de ${d.nome} (${d.parentesco}, ${idade} anos)`,
      data: prox,
      emDias: diasAte(prox, dataReferencia),
      aniversario: { de: "DEPENDENTE", nome: d.nome, parentesco: d.parentesco, idade },
    };
  });
  const eventos = (cliente.eventosVida ?? [])
    .filter((e) => !(e.tipo === "ANIVERSARIO" && deps.some((d) => e.descricao.includes(d.nome))))
    .map((e): DataEspecial => ({
      id: `evt-${cliente.id}-${e.id}`,
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      titulo: e.descricao,
      data: e.data,
      emDias: diasAte(e.data, dataReferencia),
    }));
  return [...doCliente, ...aniversarios, ...eventos].filter((d) => d.emDias >= 0);
}

function deDataEspecial(d: DataEspecial, dataReferencia?: string): Notificacao {
  const quando = d.emDias === 0 ? "hoje" : d.emDias === 1 ? "amanhã" : `em ${d.emDias} dias`;
  return {
    id: d.id,
    clienteId: d.clienteId,
    clienteNome: d.clienteNome,
    categoria: "DATA_ESPECIAL",
    // aniversário do próprio cliente no dia é o contato mais quente da lista
    severidade: d.aniversario?.de === "CLIENTE" && d.emDias === 0 ? "ALTA" : "BAIXA",
    titulo: `${d.titulo} ${quando}`,
    descricao: d.aniversario?.de === "CLIENTE"
      ? d.emDias === 0
        ? "Hoje é aniversário do cliente: o contato de relacionamento mais lembrado do ano."
        : "Aniversário do cliente chegando. Um bom motivo para um contato de relacionamento."
      : d.aniversario
      ? "Um bom motivo para um contato de relacionamento: mande uma mensagem ou lembre disso na próxima ligação."
      : "Momento de vida que pode mudar prioridades financeiras. Vale um contato para entender o planejamento.",
    criadaEm: `${dataReferencia ?? new Date().toISOString().slice(0, 10)}T08:00:00`,
    dataEvento: d.data,
    emDias: d.emDias,
    aniversario: d.aniversario,
    novo: false,
  };
}

export const ehAniversarioHoje = (n: Notificacao) => n.aniversario != null && n.emDias === 0;

const pesoSeveridade: Record<Severidade, number> = { ALTA: 0, MEDIA: 1, BAIXA: 2 };

/** Aniversário de hoje primeiro, depois novos, severidade e proximidade. */
export function ordenarNotificacoes(lista: Notificacao[]): Notificacao[] {
  return [...lista].sort(
    (a, b) =>
      Number(ehAniversarioHoje(b)) - Number(ehAniversarioHoje(a)) ||
      Number(b.novo) - Number(a.novo) ||
      pesoSeveridade[a.severidade] - pesoSeveridade[b.severidade] ||
      (a.emDias ?? Infinity) - (b.emDias ?? Infinity) ||
      b.criadaEm.localeCompare(a.criadaEm),
  );
}

/** Monta as notificações da carteira a partir dos endpoints existentes. */
export async function carregarNotificacoes(api: Api): Promise<ResultadoNotificacoes> {
  const [clientes, dataReferencia] = await Promise.all([
    api.listarClientes(),
    api.demoEstado().then(
      (e) => e.dataReferencia,
      () => undefined,
    ),
  ]);
  const visoes = await Promise.all(clientes.map((c) => api.visao360(c.id)));

  const notificacoes: Notificacao[] = [];
  const proximasDatas: DataEspecial[] = [];
  for (const v of visoes) {
    for (const a of v.alertas) {
      // eventos de vida são montados abaixo a partir do cadastro, com janela e texto próprios
      if (a.tipo === "EVENTO_VIDA_PROXIMO") continue;
      notificacoes.push(deAlerta(a, v.cliente.nome));
    }
    for (const d of datasEspeciais(v.cliente, dataReferencia)) {
      if (d.emDias <= JANELA_PROXIMAS_DATAS) proximasDatas.push(d);
      if (d.emDias <= JANELA_NOTIFICACAO_DATAS) notificacoes.push(deDataEspecial(d, dataReferencia));
    }
  }
  proximasDatas.sort((a, b) => a.emDias - b.emDias);
  return { notificacoes: ordenarNotificacoes(notificacoes), proximasDatas, dataReferencia };
}

// ---------- Estado local (por navegador) ----------
// PROVISÓRIO: notificações lidas ficam no localStorage. Quando o backend guardar isso,
// troque por queries/mutations.

const VAZIO: readonly string[] = [];

/** Conjunto de ids persistido no localStorage, pronto para useSyncExternalStore. */
export interface ConjuntoLocal {
  ler(): readonly string[];
  assinar(cb: () => void): () => void;
  noServidor(): readonly string[];
  adicionar(ids: Id[]): void;
  remover(id: Id): void;
}

function conjuntoLocal(chave: string): ConjuntoLocal {
  let cache: { bruto: string | null; ids: readonly string[] } = { bruto: null, ids: VAZIO };

  function ler(): readonly string[] {
    let bruto: string | null;
    try {
      bruto = window.localStorage.getItem(chave);
    } catch {
      return cache.ids;
    }
    if (bruto === cache.bruto) return cache.ids;
    let ids: readonly string[] = VAZIO;
    try {
      const v: unknown = bruto ? JSON.parse(bruto) : [];
      if (Array.isArray(v)) ids = v.filter((x): x is string => typeof x === "string");
    } catch {
      /* valor inválido: ignora */
    }
    cache = { bruto, ids };
    return ids;
  }

  function gravar(ids: Iterable<string>) {
    const lista = [...new Set(ids)];
    try {
      window.localStorage.setItem(chave, JSON.stringify(lista));
    } catch {
      cache = { bruto: JSON.stringify(lista), ids: lista };
    }
    window.dispatchEvent(new Event(chave));
  }

  return {
    ler,
    assinar(cb) {
      window.addEventListener(chave, cb);
      window.addEventListener("storage", cb);
      return () => {
        window.removeEventListener(chave, cb);
        window.removeEventListener("storage", cb);
      };
    },
    noServidor: () => VAZIO,
    adicionar: (ids) => gravar([...ler(), ...ids]),
    remover: (id) => gravar(ler().filter((x) => x !== id)),
  };
}

export const lidas = conjuntoLocal("rotaxp:notificacoes:lidas");

export const marcarLidas = (ids: Id[]) => lidas.adicionar(ids);
export const marcarNaoLida = (id: Id) => lidas.remover(id);
