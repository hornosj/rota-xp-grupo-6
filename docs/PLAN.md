# Plano de implementação — Copiloto do Assessor

> Para o Claude Code: este documento é a fonte da verdade de escopo, contrato e regras.
> Leia o `CLAUDE.md` da raiz antes. Implemente só o que estiver no backlog do seu papel (§10),
> na ordem de prioridade. Se algo aqui estiver ambíguo ou contraditório, pergunte antes de inventar.

Sumário:
1. Produto e roteiro da demo
2. Arquitetura
3. Estrutura do repositório
4. Modelo de domínio e contrato
5. Endpoints
6. Dados sintéticos e casos-âncora
7. Algoritmos (análise)
8. Camada de IA (Copiloto e Embabel)
9. Frontend
10. Backlog por papel
11. Fases e checkpoints
12. Riscos e plano B
13. Configuração de referência

---

## 1. Produto e roteiro da demo

**Tese:** o assessor não tem tempo para o relacionamento. O Copiloto junta os dados do cliente
(Open Finance), identifica **onde a XP está na vida financeira dele (principalidade)** e transforma
isso em uma fila de **motivos para ligar** com mensagem pronta.

**O sistema é só do assessor.** Não há app do cliente nem gamificação: o cliente só aparece na ponta de
um **convite de consentimento Open Finance** enviado pelo assessor (tela simulada do banco de origem).
O incentivo para o cliente conectar é o motivo concreto que o assessor dá ("checar sua proteção no FGC").
Visão de futuro (só no pitch, sem código): o convite cai no app da XP, que já é instituição receptora de
Open Finance; dali dá para evoluir uma experiência do lado do cliente.

Ciclo: assessor convida → consentimento → dados → principalidade e visão 360 → assessor age →
relacionamento → principalidade sobe.

**Roteiro da demo (o fluxo sagrado — tudo que não serve a ele é P1/P2):**

1. `/palco`: à esquerda o assessor, à direita o celular da Marina (conversa de WhatsApp simulada).
2. A assessora abre a **fila "Hoje"**. A Dra. Marina (cli-001) está em 2º lugar: Banco Aurora é a
   instituição principal (salário, contas, cartão, financiamento); a XP é "só investimentos";
   R$ 61 mil parados em conta corrente; aniversário da filha em 5 dias.
3. Na 360 da Marina: cobertura 2 de 3, Banco Horizonte pendente. Ação "Convidar a conectar o Banco
   Horizonte" → **Enviar convite** → mensagem gerada com o link.
4. No celular aparece a mensagem com o link; Marina abre e confirma no "ambiente do Banco Horizonte"
   (simulado; botão "Simular confirmação" no palco como plano B).
5. A tela da assessora atualiza sozinha (polling): cobertura 3 de 3, Marina vai para o **1º lugar** da
   fila, com alertas **NOVO** de FGC (**R$ 400 mil acima da cobertura**) e de exposição sem garantia, e a
   próxima melhor ação "Diversificar emissores".
6. A assessora clica em **Gerar mensagem** na nova ação: o agente escreve a mensagem de WhatsApp, citando
   o aniversário da Sofia. Fim com o ciclo.

---

## 2. Arquitetura

```
┌──────────────────────── Next.js :3000 ─────────────────────────┐
│ /assessor (painel, hoje, radar, clientes/[id])  /convite  /palco │
│ TanStack Query (polling 2s no modo ao vivo)                     │
└───────────────┬────────────────────────────────────────────────┘
                │ fetch /api/*  (rewrite do Next → :8080)
┌───────────────▼──────────── Spring Boot :8080 ─────────────────┐
│ api/            controllers REST (springdoc → /v3/api-docs)     │
│ openfinance/    provedor OF simulado, consentimentos, convites  │
│                 OpenFinanceGateway: só devolve dados de         │
│                 instituições com consentimento ATIVO + escopo   │
│ consolidacao/   patrimônio, cobertura, Visao360Assembler        │
│ analise/        categorização, renda, fluxo de caixa,           │
│                 principalidade, FGC, alertas, prioridade        │
│ inteligencia/   próximas melhores ações, fila, painel, radar    │
│ agentes/        Copiloto (stub|cache|record|live) + Embabel     │
│ demo/           DataReferencia, reset, registro de alertas      │
│ repositório em memória  ←  resources/seed/*.json                │
└────────────────────────────────────────────────────────────────┘
                ▲ gerado por data/gerar_seed.py (analista)
```

Princípios:
- **Tudo derivado é calculado na leitura** a partir do estado atual (consentimentos). Cache por
  cliente invalidado pelo evento `ConsentimentoAlterado` (Spring `ApplicationEvent`).
- **A camada `analise` nunca lê o repositório cru:** só via `OpenFinanceGateway`. É isso que faz o
  Banco Horizonte "aparecer" quando a Marina dá o consentimento.
- **A XP é a plataforma:** os dados da XP têm consentimento `INTERNO`, sempre ativo.
- **LLM redige, não calcula.**

---

## 3. Estrutura do repositório

```
/
├── CLAUDE.md
├── README.md                      (BE1 cria: como rodar)
├── docs/  PLAN.md  prompts/  pitch-numeros.md (analista, P1)  radar.md
├── contract/
│   ├── openapi.json               (exportado do springdoc)
│   └── fixtures/                  (respostas de exemplo: cli-001 antes/depois, fila, convite...)
├── data/
│   └── gerar_seed.py
├── backend/
│   ├── pom.xml  mvnw
│   ├── llm-cache/                 (respostas do LLM gravadas para a demo — commitar)
│   └── src/main/java/br/com/rotaxp/copiloto/
│       ├── CopilotoApplication.java
│       ├── config/                (propriedades tipadas: Premissas, PesosPrincipalidade, ...)
│       ├── dominio/               (records do §4)
│       ├── openfinance/           (SeedLoader, Repositorios, OpenFinanceGateway, ConsentimentoService,
│       │                           ConviteService)
│       ├── consolidacao/          (PatrimonioService, CoberturaService, Visao360Assembler)
│       ├── analise/               (Categorizador, DetectorRenda, FluxoCaixaService,
│       │                           PrincipalidadeService, FgcService, AlertaService, PrioridadeService)
│       ├── inteligencia/          (AcaoSugeridaService, FilaService, PainelService, radar/)
│       ├── agentes/               (Copiloto, CopilotoStub, CopilotoCache, agentes Embabel)
│       ├── demo/                  (DataReferencia, DemoService, RegistroAlertas)
│       └── api/                   (controllers)
│   └── src/main/resources/  application.yml  seed/*.json
│   └── src/test/  java/...  resources/esperados.json
└── frontend/
    ├── next.config.ts             (rewrite /api/* → BACKEND_URL)
    └── src/
        ├── app/  page.tsx  assessor/  convite/  palco/
        ├── components/  ui/ (shadcn)  assessor/  convite/  palco/  comum/
        ├── lib/  api.ts  api-types.ts (gerado)  queries.ts  formato.ts
        └── mocks/                 (cópia de contract/fixtures para o modo mock)
```

---

## 4. Modelo de domínio e contrato

Notação TypeScript para ser legível; no Java viram `record`s com os mesmos nomes de campo.
Datas: `string` ISO (`YYYY-MM-DD`, ou ISO-8601 com hora em `*Em`). Dinheiro: `number` em reais.
Frações 0–1, scores 0–100.

### 4.1 Entidades (seed)

```ts
type Id = string;
type PerfilInvestidor = 'CONSERVADOR' | 'MODERADO' | 'ARROJADO' | 'AGRESSIVO';
type ProdutoDeclarado = 'CONTA' | 'CARTAO' | 'CREDITO' | 'INVESTIMENTOS';
type Escopo = 'CONTAS' | 'CARTOES' | 'CREDITO' | 'INVESTIMENTOS';

interface Instituicao { id: Id; nome: string; conglomeradoId: Id; conglomeradoNome: string; ehXp: boolean; }
interface Emissor { id: Id; nome: string; conglomeradoId: Id; tipo: 'BANCO' | 'EMPRESA' | 'TESOURO'; }

interface Cliente {
  id: Id; nome: string; cpf: string; idade: number; profissao: string; cidade: string;
  perfil: PerfilInvestidor; assessorId: Id; ancora: boolean;
  instituicoesDeclaradas: { instituicaoId: Id; produtos: ProdutoDeclarado[] }[];
  dependentes: { nome: string; parentesco: string; dataNascimento: string }[];
  eventosVida: EventoVida[];
}
interface EventoVida {
  id: Id; tipo: 'ANIVERSARIO' | 'CASAMENTO' | 'NASCIMENTO' | 'FERIAS' | 'APOSENTADORIA' | 'MUDANCA' | 'OUTRO';
  descricao: string; data: string; origem: 'CADASTRO' | 'NOTA_REUNIAO';
}
interface Consentimento {
  id: Id; clienteId: Id; instituicaoId: Id;
  tipo: 'OPEN_FINANCE' | 'INTERNO';
  status: 'ATIVO' | 'PENDENTE' | 'EXPIRADO' | 'REVOGADO';
  escopos: Escopo[]; concedidoEm?: string; expiraEm?: string;
}
interface Conta { id: Id; clienteId: Id; instituicaoId: Id; tipo: 'CORRENTE' | 'PAGAMENTO'; saldo: number; }
interface Transacao {
  id: Id; contaId: Id; data: string; valor: number;            // sempre positivo
  tipo: 'CREDITO' | 'DEBITO';
  modalidade: 'PIX' | 'TED' | 'BOLETO' | 'DEBITO_AUTOMATICO' | 'CARTAO_DEBITO' | 'TARIFA' | 'OUTRO';
  descricao: string; contraparteDocumento?: string; contraparteNome?: string;
}
interface FaturaCartao { id: Id; clienteId: Id; instituicaoId: Id; mesReferencia: string; valorTotal: number; } // 'YYYY-MM'
interface OperacaoCredito {
  id: Id; clienteId: Id; instituicaoId: Id;
  tipo: 'IMOBILIARIO' | 'VEICULO' | 'PESSOAL' | 'CONSIGNADO' | 'RURAL';
  saldoDevedor: number; parcelaMensal: number; taxaAnual: number;
}
type Produto = 'CDB' | 'RDB' | 'LCI' | 'LCA' | 'LC' | 'POUPANCA' | 'TESOURO' | 'DEBENTURE'
             | 'CRI' | 'CRA' | 'FUNDO' | 'ACAO' | 'PREVIDENCIA';
interface PosicaoInvestimento {
  id: Id; clienteId: Id;
  instituicaoId: Id;            // custodiante (onde está) → usado na PRINCIPALIDADE
  emissorId?: Id;               // quem emitiu → usado no FGC e na concentração
  produto: Produto; nome: string;
  valorAplicado: number; valorAtual: number;   // valorAtual fixo na data de referência
  dataAplicacao: string; vencimento?: string;
  indexador: 'CDI' | 'IPCA' | 'PRE' | 'SELIC' | 'NA'; taxa?: string;
  liquidezDiaria: boolean;
}
```

### 4.2 Respostas derivadas (API)

```ts
type PosicaoXp = 'PRINCIPAL' | 'SECUNDARIA' | 'SO_INVESTIMENTOS' | 'AUSENTE';

interface Visao360 {
  cliente: Cliente; atualizadoEm: string;
  cobertura: Cobertura; patrimonio: Patrimonio; principalidade: Principalidade;
  fluxoCaixa: FluxoCaixa; alertas: Alerta[]; acoes: AcaoSugerida[];
  consentimentos: (Consentimento & { instituicaoNome: string })[];
}
interface Cobertura {
  instituicoesDeclaradas: number; instituicoesConectadas: number; percentual: number;
  pendentes: { instituicaoId: Id; nome: string; produtos: ProdutoDeclarado[] }[];
}
interface Patrimonio {
  totalVisivel: number; naXp: number; foraXp: number; shareOfWalletXp: number;
  porInstituicao: { instituicaoId: Id; nome: string; ehXp: boolean; investimentos: number; saldoContas: number; total: number }[];
  porProduto: { produto: Produto | 'SALDO_CONTA'; total: number }[];
}
interface Principalidade {
  instituicaoPrincipalId: Id; instituicaoPrincipalNome: string;
  posicaoXp: PosicaoXp; explicacao: string; scores: ScoreInstituicao[];
}
interface ScoreInstituicao {
  instituicaoId: Id; nome: string; ehXp: boolean; score: number;
  participacoes: { renda: number; movimentacao: number; contasRecorrentes: number;
                   investimentos: number; cartao: number; credito: number };   // 0–1 cada
  contribuicoes: { renda: number; movimentacao: number; contasRecorrentes: number;
                   investimentos: number; cartao: number; credito: number };   // pontos; somam o score
  destaques: string[];   // ex.: ["recebe 100% da renda", "85% da movimentação"]
}
interface FluxoCaixa {
  rendaMensal: number;
  fontesRenda: { pagadorNome: string; instituicaoId: Id; valorMensal: number; diaDoMes: number }[];
  custoVidaMensal: number; capacidadeAporteMensal: number;
  liquidezImediata: number; reservaEmergenciaMeses: number;
  parcial: boolean; observacao?: string;
}
type TipoAlerta = 'FGC_EXCEDIDO' | 'FGC_TETO_GLOBAL' | 'CONCENTRACAO_EMISSOR' | 'VENCIMENTO_PROXIMO'
  | 'SALDO_PARADO' | 'RENDA_FORA_XP' | 'CONSENTIMENTO_EXPIRANDO' | 'EVENTO_VIDA_PROXIMO' | 'RESERVA_INSUFICIENTE';
interface Alerta {
  id: Id; clienteId: Id; tipo: TipoAlerta; severidade: 'ALTA' | 'MEDIA' | 'BAIXA';
  titulo: string; explicacao: string;   // linguagem simples, com os números
  valor?: number; instituicaoId?: Id; emissorId?: Id;
  detectadoEm: string; novo: boolean;
}
type TipoAcao = 'DIVERSIFICAR_FGC' | 'REDUZIR_CONCENTRACAO' | 'APLICAR_SALDO_PARADO' | 'APORTE_PROGRAMADO'
  | 'REINVESTIR_VENCIMENTO' | 'RENOVAR_CONSENTIMENTO' | 'CONTATO_RELACIONAMENTO' | 'CONVIDAR_CONEXAO' | 'MONTAR_RESERVA';
interface AcaoSugerida {
  id: Id; clienteId: Id; tipo: TipoAcao; titulo: string; motivo: string;
  impactoEstimado?: string; alertaIds: Id[]; principal: boolean;
}
interface ItemFila {
  posicao: number; clienteId: Id; nome: string; perfil: PerfilInvestidor;
  prioridade: number; motivos: { texto: string; pontos: number }[];
  acaoPrincipal?: AcaoSugerida; posicaoXp: PosicaoXp; novo: boolean;
}
interface PainelCarteira {
  assessorId: Id; totalClientes: number; patrimonioNaXp: number; patrimonioForaXpVisivel: number;
  pctClientesXpPrincipal: number; distribuicaoPosicaoXp: Record<PosicaoXp, number>;
  coberturaMedia: number; consentimentosExpirando15d: number; clientesComAlertaAlto: number;
}
interface Convite {        // convite de consentimento Open Finance enviado pelo assessor
  token: string; clienteId: Id; instituicaoId: Id; instituicaoNome: string;
  escopos: Escopo[]; prazoMeses: number;          // 12
  link: string;                                   // ex.: http://localhost:3000/convite/{token}
  status: 'PENDENTE' | 'CONFIRMADO' | 'EXPIRADO';
  criadoEm: string; expiraEm: string;             // expira em 48h
}
interface MensagemGerada { texto: string; canal: 'WHATSAPP' | 'EMAIL'; geradoPor: 'stub' | 'cache' | 'live'; }
interface Briefing { clienteId: Id; bullets: string[]; perguntasSugeridas: string[]; geradoPor: 'stub' | 'cache' | 'live'; }
interface ResultadoNota { resumo: string; eventosCriados: EventoVida[]; metas: string[];
                          mudancasPerfil: string[]; acoesCriadas: AcaoSugerida[]; geradoPor: 'stub' | 'cache' | 'live'; }
```

---

## 5. Endpoints

Base `/api`. JSON. Sem autenticação (demo). Um único assessor: `ass-001`.

| Método | Caminho | Resposta | Dono | Prio |
|---|---|---|---|---|
| GET | `/clientes` | `{ id, nome, perfil, posicaoXp, prioridade }[]` | BE1 | P0 |
| GET | `/clientes/{id}/360` | `Visao360` | BE1 | P0 |
| GET | `/clientes/{id}/principalidade` | `Principalidade` | BE1 | P0 |
| GET | `/clientes/{id}/consentimentos` | `Visao360['consentimentos']` | BE1 | P0 |
| POST | `/clientes/{id}/consentimentos/{instituicaoId}/conceder` | `Visao360` (já recalculada) | BE1 | P0 |
| POST | `/clientes/{id}/consentimentos/{instituicaoId}/revogar` | `Visao360` | BE1 | P1 |
| GET | `/assessor/fila` | `ItemFila[]` (ordenada) | BE2 | P0 |
| GET | `/assessor/painel` | `PainelCarteira` | BE1 | P1 |
| POST | `/clientes/{id}/convites/{instituicaoId}` | `Convite` (reaproveita o PENDENTE se já existir) | BE1 | P0 |
| GET | `/clientes/{id}/convites` | `Convite[]` | BE1 | P0 |
| GET | `/convites/{token}` | `Convite` | BE1 | P0 |
| POST | `/convites/{token}/confirmar` | `Convite` (CONFIRMADO; chama `conceder`) | BE1 | P0 |
| POST | `/clientes/{id}/acoes/{acaoId}/mensagem` body `{ canal }` | `MensagemGerada` | BE2 | P0 |
| GET | `/clientes/{id}/briefing` | `Briefing` | BE2 | P1 |
| POST | `/clientes/{id}/notas` body `{ transcricao, origem? }` (`AUDIO` \| `TEXTO`) | `ResultadoNota` (+ `necessidades`, `recomendacoes`) | BE2 | P2 |
| GET | `/clientes/{id}/contexto` | `ContextoAssessor { clienteId, anotacoes[], recomendacoes[] }` | BE2 | P2 |
| POST | `/simulacoes/desagio` body `{ desagio, taxaAntiga, taxaNova, prazoRestanteAnos }` | `{ breakEvenAnos, compensa, explicacao }` | Analista | P2 |
| POST | `/demo/reset` | `204` | BE1 | P0 |
| GET | `/demo/estado` | `{ dataReferencia, modoCopiloto }` | BE1 | P0 |
| GET/POST | `/radar/noticias`, `/radar/processar`, `/clientes/{id}/radar`, `/assessor/radar`, `/clientes/{id}/radar/{noticiaId}/motivo` | radar de notícias (ver `docs/radar.md`) | BE2 | P2 |

Erros: `404` com `{ erro, mensagem }` para cliente/instituição/convite inexistente; `409` ao conceder
consentimento já ativo, ao confirmar convite já confirmado (o front trata os dois como sucesso) e ao
convidar para instituição já conectada; `410` para convite expirado.

Convites ficam em memória e são apagados no `POST /demo/reset`; token determinístico (sem
`UUID.randomUUID()`), para a demo ser reprodutível. **Contrato v2:** `GET /clientes/{id}/jornada` e os tipos
`Jornada`, `Missao` e `Diagnostico` foram removidos no reescopo.

---

## 6. Dados sintéticos e casos-âncora

Gerador: `data/gerar_seed.py` (Python 3, só biblioteca padrão, `random.seed(42)`), parâmetro
`--data-referencia` (padrão `2026-10-11`; **usem a data do pitch**). Saída em
`backend/src/main/resources/seed/`: `instituicoes.json`, `emissores.json`, `clientes.json`,
`consentimentos.json`, `contas.json`, `transacoes.json`, `faturas.json`, `creditos.json`,
`investimentos.json`.

**Período:** 6 meses completos antes do mês de referência (abr–set/2026 para ref 2026-10-11).
**Totais mensais exatos** por categoria; a aleatoriedade só reparte o total de "consumo" em 8–15
transações. Datas de vencimento, expiração e aniversários são **relativas à data de referência**.

### 6.1 Instituições e emissores

| id | nome | conglomerado | observação |
|---|---|---|---|
| inst-xp | XP Investimentos | cong-xp | plataforma (consentimento INTERNO) |
| inst-aurora | Banco Aurora | cong-aurora | banco grande de varejo |
| inst-aurora-fin | Aurora Financeira | cong-aurora | **mesmo conglomerado** do Aurora (pega no FGC) |
| inst-horizonte | Banco Horizonte | cong-horizonte | banco médio |
| inst-ipe | Banco Ipê | cong-ipe | banco digital |

Emissores: os 5 acima (tipo BANCO, `emi-<nome>`), `emi-tesouro` (Tesouro Nacional, TESOURO),
`emi-agrosul` (Agro Sul Sementes S.A., EMPRESA, cong-agrosul).

### 6.2 Vocabulário das descrições (o categorizador depende disso)

`SALARIO <PAGADOR>`, `PRO LABORE <PAGADOR>`, `INSS BENEFICIO`, `APLICACAO XP`, `RESGATE XP`,
`FATURA CARTAO <BANCO>`, `PARCELA FINANCIAMENTO`, `CONDOMINIO`, `ALUGUEL`, `ENERGIA`, `AGUA`,
`INTERNET`, `TELEFONE`, `PLANO DE SAUDE`, `ESCOLA`, `ACADEMIA`, `PIX ENVIADO <NOME>`,
`COMPRA DEBITO <LOJA>`, `TARIFA PACOTE`. Transferências próprias têm `contraparteDocumento` = CPF
do cliente. Contas na XP são tipo `PAGAMENTO`; nos bancos, `CORRENTE`.

### 6.3 Os 6 clientes-âncora (valores exatos)

**cli-001 — Dra. Marina Costa** · 42 · médica cardiologista · Ribeirão Preto/SP · ARROJADO
- Declaradas: XP `[INVESTIMENTOS]`, Aurora `[CONTA, CARTAO, CREDITO]`, Horizonte `[INVESTIMENTOS]`.
- Consentimentos: XP INTERNO ATIVO · Aurora ATIVO (expira ref+300d) · **Horizonte PENDENTE** `[INVESTIMENTOS]`.
- Dependentes: Sofia (filha) nascida **2014-10-16** (aniversário em ref+5) · Pedro (filho) 2017-03-02.
- Aurora, conta corrente saldo **85.000**. Mensal: `SALARIO HOSPITAL SANTA CLARA` 38.000 (dia 5) ·
  CONDOMINIO 2.800 · ENERGIA 450 · INTERNET 150 · ESCOLA 3.200 · PARCELA FINANCIAMENTO 6.500 ·
  consumo 1.900 · `FATURA CARTAO AURORA` 9.000 (paga da conta) · `APLICACAO XP` 5.000.
- Faturas cartão Aurora: 9.000/mês. Crédito: IMOBILIARIO Aurora, saldo 620.000, parcela 6.500.
- XP (total **900.000**): Tesouro IPCA+ 280.000 · fundo multimercado 260.000 ·
  CDB Banco Ipê 160.000 (vencimento 2028) · CDB liquidez diária Banco Ipê 70.000 · ações 130.000.
- **Horizonte (oculto até o consentimento):** CDB Banco Horizonte **650.000**.

**cli-002 — Carlos Andrade** · 61 · empresário (embalagens) · Campinas/SP · CONSERVADOR
- Declaradas: XP `[CONTA, CARTAO, INVESTIMENTOS]`, Aurora `[CONTA]`. Consentimentos: XP INTERNO ·
  **Aurora ATIVO expira ref+10**.
- XP conta saldo 18.000. Mensal: `PRO LABORE ANDRADE EMBALAGENS` 25.000 (dia 1) · CONDOMINIO 1.900 ·
  ENERGIA 600 · PLANO DE SAUDE 2.400 · consumo 2.500 · `FATURA CARTAO XP` 5.000. Faturas XP 5.000/mês.
- Aurora conta saldo 3.000. Mensal: AGUA 200 (débito automático) · consumo 1.000.
- XP investimentos: **CDB Banco Ipê 240.000 vencendo em ref+20** · LCA Banco Aurora 200.000 ·
  Tesouro Selic 800.000 (liquidez diária) · fundo renda fixa 400.000.

**cli-003 — Juliana Prado** · 29 · engenheira de software · São José dos Campos/SP · MODERADO
- Declaradas: XP `[INVESTIMENTOS]`, Ipê `[CONTA]`, Aurora `[CARTAO]`. Consentimentos: XP INTERNO ·
  Ipê ATIVO · **Aurora PENDENTE** `[CARTOES]`.
- Ipê conta saldo 22.000. Mensal: `SALARIO TECHVALE SISTEMAS` 14.000 (dia 5) · ALUGUEL 2.900 ·
  ENERGIA 180 · INTERNET 120 · ACADEMIA 150 · consumo 2.650 · `FATURA CARTAO AURORA` 3.000 · `APLICACAO XP` 1.000.
- Faturas cartão Aurora (ocultas): 3.000/mês.
- XP: CDB liquidez diária Banco Ipê 5.000 · fundo 35.000 · Tesouro IPCA+ 20.000 (total 60.000).

**cli-004 — Patrícia Gomes** · 68 · professora aposentada · Bauru/SP · CONSERVADOR
- Declaradas: XP `[INVESTIMENTOS]`, Aurora `[CONTA, INVESTIMENTOS]`, Aurora Financeira `[INVESTIMENTOS]`.
  Todos ATIVOS.
- Aurora conta saldo 6.000. Mensal: `INSS BENEFICIO` 8.500 (dia 25) · ENERGIA 220 · AGUA 90 ·
  TELEFONE 110 · PLANO DE SAUDE 1.800 · consumo 1.780.
- Poupança Aurora 150.000 (liquidez diária) · LCI Aurora Financeira 174.000 · XP: Tesouro Selic 400.000.
- Ponto da âncora: **cada instituição fica abaixo de R$ 250 mil, mas o conglomerado Aurora soma 330 mil**.

**cli-005 — Roberto Lima** · 50 · produtor rural · Sertãozinho/SP · MODERADO
- Declaradas: XP `[INVESTIMENTOS]`, Ipê `[CONTA, CARTAO, CREDITO]`. Todos ATIVOS.
- Ipê conta saldo 25.000. Mensal: `PRO LABORE FAZENDA BOA VISTA` 20.000 (dia 10) · ENERGIA 900 ·
  PLANO DE SAUDE 2.000 · ESCOLA 2.500 · consumo 4.600 · `FATURA CARTAO IPE` 5.000 · PARCELA FINANCIAMENTO 4.000.
  Faturas Ipê 5.000/mês. Crédito: RURAL Ipê, saldo 350.000, parcela 4.000.
- Dependente: Ana (filha) 2002-12-01. Evento: CASAMENTO "Casamento da Ana" 2027-03-20.
- XP: **CRA Agro Sul Sementes 900.000** · Tesouro Selic 600.000 · fundo 300.000 · LCA Banco Horizonte 200.000.

**cli-006 — Lucas Ferreira** · 35 · dentista, dono de clínica · Piracicaba/SP · AGRESSIVO (caso controle)
- Declaradas: XP `[CONTA, CARTAO, INVESTIMENTOS]`. XP conta saldo 12.000.
  Mensal: `PRO LABORE CLINICA SORRISO PLENO` 22.000 · CONDOMINIO 1.500 · ENERGIA 300 · INTERNET 150 ·
  PLANO DE SAUDE 1.050 · consumo 3.500 · `FATURA CARTAO XP` 6.000. Faturas XP 6.000/mês.
- XP: ações 300.000 · fundo 200.000 · Tesouro Selic 100.000. Evento: OUTRO "Abertura da 2ª clínica" 2027-01-15.

### 6.4 Clientes de fundo

30 clientes (`cli-101`…`cli-130`), 1–3 instituições, ~20% com XP principal (renda na conta XP),
para o painel ter números realistas. **Restrições** (para não roubarem a fila): saldo em conta ≤ 1×
custo mensal, liquidez ≥ 6× custo, nenhuma posição que dispare FGC/concentração/vencimento,
nenhum consentimento expirando, nenhum aniversário de dependente em 7 dias. Prioridade máxima
esperada: 15.

### 6.5 Resultados esperados (viram `backend/src/test/resources/esperados.json`)

| Cliente | Principal | posicaoXp | Custo vida | Alertas obrigatórios |
|---|---|---|---|---|
| cli-001 antes | inst-aurora | SO_INVESTIMENTOS | 24.000 | SALDO_PARADO (61.000), RENDA_FORA_XP, EVENTO_VIDA_PROXIMO — **sem** FGC e sem RESERVA |
| cli-001 depois de conceder inst-horizonte | inst-aurora | SO_INVESTIMENTOS | 24.000 | + **FGC_EXCEDIDO 400.000** (cong-horizonte), + CONCENTRACAO_EMISSOR (MEDIA, 24,5%) |
| cli-002 | inst-xp | PRINCIPAL | 13.600 | VENCIMENTO_PROXIMO (240.000), CONSENTIMENTO_EXPIRANDO (Aurora) |
| cli-003 | inst-ipe | SO_INVESTIMENTOS | 9.000 | SALDO_PARADO (13.000), RENDA_FORA_XP, RESERVA_INSUFICIENTE (3,0 meses) |
| cli-004 | inst-aurora | SO_INVESTIMENTOS | 4.000 | **FGC_EXCEDIDO 80.000** (cong-aurora), RENDA_FORA_XP |
| cli-005 | inst-ipe | SO_INVESTIMENTOS | 19.000 | CONCENTRACAO_EMISSOR **ALTA** (Agro Sul, ~44%) |
| cli-006 | inst-xp | PRINCIPAL | 12.500 | nenhum |

Fila (com os pesos do §7.9): antes → cli-004 (54) · cli-001 (39,1) · cli-003 (34,3) · cli-005 (30)
· cli-002 (29,8) · cli-006 (0). **Depois** do consentimento da Marina → cli-001 em 1º (100).
O teste obrigatório é: *Marina não é a 1ª antes; é a 1ª depois*. O resto é calibrável.

---

## 7. Algoritmos (camada `analise` e `inteligencia`)

Todos os parâmetros vêm do `application.yml` (§13). Janela de "mês" = últimos 3 meses completos
antes da data de referência (custo de vida, cartão); renda usa os 6 meses.

### 7.1 Categorização de transações (regras, em ordem)
1. `contraparteDocumento == cpf do cliente` → `TRANSFERENCIA_PROPRIA`
2. descrição começa com `APLICACAO` → `APLICACAO`; com `RESGATE` → `RESGATE`
3. contém `FATURA CARTAO` → `PAGAMENTO_FATURA` (guarde o banco do cartão)
4. contém `PARCELA` → `PARCELA_CREDITO`
5. DEBITO com modalidade `BOLETO`/`DEBITO_AUTOMATICO`, ou descrição em {CONDOMINIO, ALUGUEL,
   ENERGIA, AGUA, INTERNET, TELEFONE, PLANO DE SAUDE, ESCOLA, ACADEMIA} → `CONTA_RECORRENTE`
6. CREDITO restante → `CREDITO_CANDIDATO_RENDA`
7. DEBITO restante → `CONSUMO`

### 7.2 Detecção de renda
Créditos `CREDITO_CANDIDATO_RENDA` agrupados por `contraparteDocumento`. É renda recorrente se
aparecer em **≥ 3 meses distintos** dos 6, com valores a **±15% da mediana**. `valorMensal` =
mediana; `diaDoMes` = mediana dos dias. `rendaMensal` = soma das fontes.

### 7.3 Fluxo de caixa
- `custoVidaMensal` = média mensal (3 meses) de `CONTA_RECORRENTE + PARCELA_CREDITO + CONSUMO`
  + faturas de cartão **visíveis** + `PAGAMENTO_FATURA` **só** de cartões cuja instituição não está
  visível (proxy, para não contar duas vezes). Se houver proxy, `parcial = true` com observação.
- `capacidadeAporteMensal` = renda − custo.
- `liquidezImediata` = saldos de conta + posições com `liquidezDiaria`.
- `reservaEmergenciaMeses` = liquidez / custo (1 casa decimal).

### 7.4 Score de principalidade
Para cada instituição visível, participações (0–1) sobre o total visível do cliente:

| Componente | Numerador por instituição | Peso padrão |
|---|---|---|
| renda | renda recorrente creditada lá | 0,30 |
| movimentacao | débitos lá, exceto `TRANSFERENCIA_PROPRIA` e `APLICACAO` | 0,20 |
| contasRecorrentes | `CONTA_RECORRENTE + PARCELA_CREDITO` pagas lá | 0,15 |
| investimentos | `valorAtual` das posições **custodiadas** lá | 0,15 |
| cartao | faturas (3 meses) do cartão de lá | 0,10 |
| credito | `saldoDevedor` lá | 0,10 |

- Se o total de um componente for zero para o cliente, ele sai da conta e os pesos restantes são
  renormalizados.
- `score = 100 × Σ(peso × participação) / Σ(pesos dos componentes disponíveis)`;
  `contribuicoes` = a parcela de cada componente nesse score (somam o score).
- Principal = maior score (empate: maior participação em renda).
- `posicaoXp`: **PRINCIPAL** se a XP é a principal e score ≥ `score-minimo-principal` (40);
  **SO_INVESTIMENTOS** se a única participação não-nula da XP é investimentos; **SECUNDARIA** se a
  XP tem alguma participação fora investimentos mas não é principal; **AUSENTE** se tudo zero.
- `destaques`: componentes com participação ≥ 0,5, como frases ("recebe 100% da renda").
- `explicacao`: "Banco Aurora é a instituição principal: recebe 100% da renda e concentra 100% dos
  pagamentos recorrentes. A XP tem 15 pontos: só investimentos."

### 7.5 FGC (simplificação documentada para o pitch)
- Elegíveis: CDB, RDB, LCI, LCA, LC, POUPANCA **+ saldo em conta CORRENTE de banco**
  (conta de PAGAMENTO, como a da XP, não entra).
- Agrupar por **conglomerado do emissor** (para saldo de conta: conglomerado da instituição da conta).
  **O que importa é o emissor, não onde está custodiado:** um CDB do Banco Ipê comprado na XP conta
  para o limite do Ipê.
- `excesso = max(0, soma − 250.000)` por conglomerado → `FGC_EXCEDIDO` (ALTA), `valor = excesso`.
- Soma de elegíveis em todos os conglomerados > 1.000.000 → `FGC_TETO_GLOBAL` (MEDIA, informativo).
- Explicação: "R$ 650 mil em CDB do Banco Horizonte. O FGC cobre até R$ 250 mil por CPF por
  conglomerado: R$ 400 mil ficariam sem garantia se o banco quebrar."

### 7.6 Exposição sem garantia (CONCENTRACAO_EMISSOR)
Por **conglomerado do emissor**: `exposicao = posições DEBENTURE/CRI/CRA de emissores do conglomerado
+ excesso FGC do conglomerado`. Patrimônio visível = investimentos visíveis + saldos de conta.
Se `exposicao / patrimônio visível > 0,20` → alerta; **ALTA** se > 0,35 ou emissor EMPRESA, senão MEDIA.
(É risco de crédito sem garantia — território do analista.)

### 7.7 Demais alertas
| Tipo | Regra | Severidade |
|---|---|---|
| VENCIMENTO_PROXIMO | `vencimento − ref ≤ 30 dias` | MEDIA |
| SALDO_PARADO | `soma dos saldos de conta − 1× custo ≥ 10.000` → valor = excesso; impacto/mês = excesso × ((1+CDI)^(1/12) − 1) | MEDIA |
| RENDA_FORA_XP | instituição da maior fonte de renda ≠ XP **e** capacidade de aporte ≥ 2.000 | BAIXA |
| CONSENTIMENTO_EXPIRANDO | `expiraEm − ref ≤ 15 dias` | MEDIA |
| EVENTO_VIDA_PROXIMO | próximo aniversário de dependente ou evento com data em ≤ 7 dias | BAIXA |
| RESERVA_INSUFICIENTE | reserva < 6 meses | MEDIA |

`novo`: `RegistroAlertas` guarda o primeiro instante em que cada chave `cliente|tipo|instituicao|emissor`
foi detectada. No startup e no reset, registra tudo como antigo. Alertas detectados depois ficam
`novo = true` por `demo.janela-alerta-novo-minutos` (10).

### 7.8 Próximas melhores ações (BE2)
| Alerta | Ação | Exemplo de título |
|---|---|---|
| FGC_EXCEDIDO | DIVERSIFICAR_FGC | "Distribuir R$ 400 mil entre emissores para ficar 100% coberta" |
| CONCENTRACAO_EMISSOR | REDUZIR_CONCENTRACAO | "Reduzir exposição sem garantia à Agro Sul" |
| SALDO_PARADO | APLICAR_SALDO_PARADO | "Levar R$ 61 mil parados para liquidez diária" |
| RENDA_FORA_XP | APORTE_PROGRAMADO | "Propor aporte programado de R$ 7 mil/mês (50% da sobra)" |
| VENCIMENTO_PROXIMO | REINVESTIR_VENCIMENTO | "R$ 240 mil vencem em 20 dias: preparar reinvestimento" |
| CONSENTIMENTO_EXPIRANDO | RENOVAR_CONSENTIMENTO | "Lembrar renovação do Open Finance com o Aurora" |
| EVENTO_VIDA_PROXIMO | CONTATO_RELACIONAMENTO | "Aniversário da Sofia em 5 dias" |
| RESERVA_INSUFICIENTE | MONTAR_RESERVA | "Completar a reserva: faltam R$ 27 mil" |
| (cobertura < 100%) | CONVIDAR_CONEXAO | "Convidar a conectar o Banco Horizonte pelo app" |

`principal = true` na ação ligada ao alerta de mais pontos (§7.9).

### 7.9 Prioridade da fila (analista calibra)
| Origem | Pontos |
|---|---|
| FGC_EXCEDIDO | 35 + min(25, excesso / 20.000) |
| FGC_TETO_GLOBAL | 10 |
| CONCENTRACAO_EMISSOR | 15 (+10 se ALTA) |
| VENCIMENTO_PROXIMO | 15 + min(10, valor / 50.000) |
| SALDO_PARADO | 10 + min(10, excesso / 10.000) |
| RENDA_FORA_XP | 10 |
| CONSENTIMENTO_EXPIRANDO | 10 |
| RESERVA_INSUFICIENTE | 8 |
| EVENTO_VIDA_PROXIMO | 8 |
| bônus posicaoXp = SO_INVESTIMENTOS | 5 |

`prioridade = min(100, soma)`. `motivos` = cada origem com seus pontos (explicável, como um scorecard).

### 7.10 Convites de conexão (BE1)
No Open Finance Brasil não existe "OTP emitido pelo assessor": a XP (receptora) cria a intenção de
consentimento, o cliente é redirecionado ao **app do banco de origem**, autentica, confirma os escopos e
volta. Na demo isso é simulado:
- A ação `CONVIDAR_CONEXAO` (cobertura < 100%) tem **Enviar convite**: o backend cria um `Convite`
  (token determinístico, escopos do consentimento pendente — ou dos produtos declarados —, prazo de
  12 meses, expira em 48h) e o Copiloto redige a mensagem de WhatsApp com o link.
- Convidar de novo reaproveita o convite PENDENTE; convidar para instituição já conectada é `409`.
- O cliente abre `/convite/[token]` (tela simulada "Você está no ambiente do Banco Horizonte") e confirma;
  a confirmação chama o `conceder` existente — o resto do sistema recalcula como sempre.
- `Cobertura` continua: é dado, não jogo (instituições **declaradas** pelo cliente que estão conectadas).

### 7.11 P2 — simulações
- **Break-even pós-deságio:** `t = ln(1/(1−D)) / ln((1+rNova)/(1+rAntiga))`; `compensa = t < prazoRestante`.
  Ex.: D=3%, 12%→14% a.a. ⇒ t ≈ 1,7 ano. Ignora IR e supõe risco equivalente (dizer isso na explicação).
- **Rentabilidade com aportes:** ganho em R$ = valor atual − total aportado; TWR = Π(1 + r_subperíodo) − 1
  entre fluxos. Ex. do brainstorm: 50k, +20%, aporte 25k, −8% ⇒ R$ 78,2k; ganho R$ 3,2k (4,3%); TWR 10,4%.

---

## 8. Camada de IA (Copiloto e Embabel)

### 8.1 Interface única
```java
public interface Copiloto {
    MensagemGerada redigirMensagem(String clienteId, String acaoId, Canal canal);
    Briefing gerarBriefing(String clienteId);
    ResultadoNota processarNota(String clienteId, String transcricao);   // P2
}
```
Implementações selecionadas por `copiloto.modo`:
- `stub` — templates determinísticos por `TipoAcao` (funciona sem chave; é o piso da demo).
- `live` — agentes Embabel chamando Claude.
- `record` — `live` + grava a resposta em `backend/llm-cache/{agente}-{clienteId}-{chave}.json`.
- `cache` — lê do cache; em falta, cai no `stub`. **É o modo da demo.**

Exemplo de stub (DIVERSIFICAR_FGC): "Oi, Marina! Tudo bem? Revisando seu patrimônio, vi que R$ 400
mil no Banco Horizonte estão acima da cobertura do FGC. Tenho uma sugestão simples para deixar tudo
protegido. Podemos falar 10 minutos amanhã? E já adianto: parabéns antecipado pelo aniversário da Sofia!"

### 8.2 Contexto (sem LLM)
`ContextoClienteFactory` monta um objeto enxuto a partir da `Visao360`: primeiro nome, perfil,
principalidade (explicação), números relevantes da ação, eventos de vida dos próximos 15 dias,
alertas e, na ação `CONVIDAR_CONEXAO`, o `link` do convite (criado se não existir). **O LLM só vê isso** — nunca dados de outros clientes, nunca números que não estão no contexto.

### 8.3 Agentes Embabel (pacote `agentes`)
Embabel planeja a execução pelos **tipos** de entrada e saída das ações (GOAP). Desenho:

```
AgenteMensagemCliente  (@Agent)
  entrada: PedidoMensagem(clienteId, acaoId, canal)
  @Action                 montarContexto(PedidoMensagem)   -> ContextoMensagem   (sem LLM)
  @Action @AchievesGoal   redigir(ContextoMensagem)        -> MensagemGerada     (LLM, saída estruturada)

AgenteBriefing  (P1)
  PedidoBriefing -> ContextoCliente (sem LLM) -> Briefing (LLM: 5 bullets + 3 perguntas)

AgenteNotaPosReuniao  (P2)
  NotaReuniao(clienteId, transcricao)
  montarContexto     -> ContextoCliente
  extrairFatos       (NotaReuniao, ContextoCliente) -> FatosExtraidos   (LLM: eventos, metas, mudanças de perfil)
  @AchievesGoal planejarFollowUp (FatosExtraidos, ContextoCliente) -> ResultadoNota  (regras + persistência)
```

Regras dos prompts (colocar no system prompt de cada ação de LLM):
- pt-BR, tom de assessor próximo e profissional, ajustado ao perfil do cliente;
- **não prometer rentabilidade**, não recomendar produto específico além do que a ação diz;
- usar os números exatamente como estão no contexto; nunca inventar valores;
- WhatsApp: até ~600 caracteres, sem markdown; e-mail: assunto + corpo curto;
- mencionar um evento de vida próximo quando houver, de forma natural;
- se faltar dado, escrever sem ele (não perguntar ao assessor).

Modelo: padrão `claude-sonnet-5-5` (configurável em `copiloto.modelo`).

**Setup (BE2-01, timebox 60 min):** Embabel 1.0 (Java 21, Spring Boot 3.5.x, Spring AI 1.1.x).
Antes de adicionar dependências, confira no Maven Central as coordenadas exatas do starter do
Embabel para Anthropic (grupo `com.embabel.agent`; há starters por provedor) e a propriedade de
modelo padrão na documentação oficial. Para testes unitários das ações, use o
`FakeOperationContext` do Embabel. **Se o setup estourar o timebox:** implemente `live` com
Spring AI `ChatClient` (mesma versão que o Embabel puxa) e siga em frente; o Embabel volta como P1.

### 8.4 Áudio (P2)
Transcrição no navegador com Web Speech API (`webkitSpeechRecognition`, `lang = 'pt-BR'`, Chrome),
com fallback de textarea e um botão "usar transcrição de exemplo" para a demo. Só o texto vai para
`POST /clientes/{id}/notas`.

**Editar cliente (notas do assessor).** Na 360, "Editar cliente" abre o ditado. A nota (ex.: "bateu o
carro") fica guardada por cliente (em memória, zera no reset) e entra no `ContextoCliente` como
`anotacoesAssessor` + `produtosRecomendados` — só aparecem no JSON quando existem, para não mudar o hash
do `llm-cache`. O LLM só **classifica** necessidades numa lista fechada (`TipoNecessidade`); o produto
sai do catálogo `anotacoes.catalogo` do `application.yml`, por regra. Transcrição no servidor (Whisper)
fica como evolução: o backend já recebe só texto, então a troca é isolada no front + um endpoint novo.

---

## 9. Frontend

### 9.1 Base (FE1-01)
- `create-next-app` com TypeScript, App Router, Tailwind, ESLint, `src/`. shadcn/ui (card, badge,
  button, dialog, progress, tabs, tooltip, skeleton, sonner). TanStack Query provider. Recharts.
- `next.config.ts`: rewrite `/api/:path*` → `${BACKEND_URL ?? 'http://localhost:8080'}/api/:path*`.
- `npm run gen:api` (openapi-typescript `../contract/openapi.json` → `src/lib/api-types.ts`);
  `npm run sync:fixtures` (copia `../contract/fixtures` → `src/mocks`); `npm run typecheck`.
- `lib/api.ts`: funções tipadas por endpoint. Com `NEXT_PUBLIC_USE_MOCKS=true`, lê de `src/mocks`
  (e `conceder` troca a Marina para a fixture "depois"). **Isso é também o plano B da demo.**
- `lib/queries.ts`: hooks (`useFila`, `useVisao360`, `usePainel`, `useConvites`, `useConfirmarConvite`, `useMensagem`).
  `useConfirmarConvite` invalida `fila`, `360`, `radar` e `convites`. Modo ao vivo (`?aoVivo=1` ou toggle): `refetchInterval: 2000`.
- `lib/formato.ts`: `brl()`, `pct()`, `data()`, `diasAte()`.

### 9.2 Assessor (FE1)
- `/assessor/hoje` (P0): lista ordenada — posição, nome, chip de perfil, barra de prioridade 0–100,
  chips de motivos (com pontos no tooltip), ação principal, badge de posição XP, tag **NOVO**
  pulsante. Clique abre a 360.
- `/assessor/clientes/[id]` (P0):
  - Cabeçalho: nome, idade, profissão, cidade, perfil; cobertura "2 de 3 instituições conectadas"
    com pendentes listadas.
  - **Card Principalidade:** badge da posição XP, frase de explicação, barras horizontais por
    instituição com segmentos coloridos por componente (`contribuicoes`), tooltip com participações.
  - Card Patrimônio: total visível, na XP vs fora, share of wallet; barras por instituição;
    pendentes como linha tracejada "não conectado".
  - Card Fluxo de caixa: renda (fontes), custo de vida, capacidade de aporte, reserva em meses;
    aviso se `parcial`.
  - Alertas por severidade (vermelho só para ALTA), com explicação e valor; destaque NOVO.
  - Ações sugeridas com botão **Gerar mensagem** → dialog com o texto, "Copiar", "Abrir no WhatsApp"
    (`https://wa.me/?text=`), badge `geradoPor`.
  - Linha do tempo de eventos de vida e dependentes.
- `/assessor` painel (P1): KPIs do `PainelCarteira` + gráfico de distribuição da posição XP.
- Briefing (P1), nota de áudio (P2), calculadora de deságio (P2).

### 9.3 Convite e palco (FE2)
- `/assessor/clientes/[id]`: o card de cobertura ganha **Enviar convite** por instituição pendente (abre o
  dialog de mensagem com o link) e mostra o status do convite (pendente/confirmado).
- `/convite/[token]` (P0, mobile 390px): logo fictício do banco, aviso "ambiente simulado", escopos, prazo,
  "você pode revogar quando quiser" → **Confirmar** → "Pronto! Sua assessora já consegue ver seus dados do
  Banco Horizonte." Trata convite confirmado, expirado e inexistente.
- `/palco` (P0): esquerda `iframe` com `/assessor/hoje?aoVivo=1` (abas para a 360 da Marina); direita
  moldura de celular com uma **conversa de WhatsApp simulada** com o convite da Marina
  (`GET /clientes/cli-001/convites`) e o link abrindo `/convite/[token]`; barra superior com **Resetar demo**
  e **Simular confirmação**. Precisa caber num projetor 1920x1080.
- `/`: lançador com palco, assessor (painel, hoje, radar) e as 360 dos clientes-âncora.
- Modo mock: fixtures de convite (pendente/confirmado); `confirmar` troca a Marina para a fixture "depois".

Design: limpo e profissional, números grandes e legíveis, verde para o que é bom, vermelho só para risco
alto. Identidade inspirada na XP só se a organização permitir.

---

## 10. Backlog por papel

Formato: **ID · prio · tarefa** — critério de aceite.

### BE1 — Open Finance, contrato e consolidação
- **BE1-01 · P0 · Bootstrap backend** — Spring Boot 3.5.x, Java 21, Maven wrapper, springdoc,
  `application.yml` do §13 com propriedades tipadas, `DataReferencia`, `README.md`. `./mvnw test` verde.
- **BE1-02 · P0 · Contrato e stubs** — records do §4, controllers do §5 devolvendo fixtures
  escritas à mão com os números da Marina (antes e depois), da fila e da jornada; exportar
  `contract/openapi.json` e `contract/fixtures/*.json`. **Push o quanto antes: destrava o front.**
- **BE1-03 · P0 · Seed e repositório em memória** — `SeedLoader` lê `seed/*.json`; `POST /demo/reset`
  recarrega tudo e reinicia `RegistroAlertas`.
- **BE1-04 · P0 · OpenFinanceGateway** — só expõe dados de consentimentos ATIVOS com o escopo certo.
  Teste: Horizonte invisível para cli-001 até conceder.
- **BE1-05 · P0 · Consentimentos** — conceder/revogar, publica `ConsentimentoAlterado`, invalida cache.
- **BE1-06 · P0 · Consolidação** — `Patrimonio`, `Cobertura`.
- **BE1-07 · P0 · Visao360 real** — `Visao360Assembler` juntando consolidação, análise e ações;
  troca os stubs pelos dados reais. Teste de integração do fluxo "antes → conceder → depois" da Marina.
- **BE1-08 · P1 · Painel da carteira.**
- **BE1-09 · P1 · Revogar consentimento** de ponta a ponta.
- **BE1-10 · P2 · SSE** `/api/eventos` (só se o polling incomodar).
- **BE1-11 · P0 · Convites** — entidade, repositório em memória, 4 endpoints, reset. TDD; teste de
  integração "convidar → confirmar → Horizonte visível → Marina em 1º".
- **BE1-12 · P0 · Contrato v2** — remover jornada, exportar `openapi.json` e fixtures.

### Analista — dados, regras e score (dirige o Claude Code no pacote `analise`; BE1 revisa)
- **AN-01 · P0 · Gerador de seed** — `data/gerar_seed.py` com os 6 âncoras exatos (§6.3) e os 30 de
  fundo (§6.4). Script de checagem imprime, por âncora, renda, custo e saldos esperados.
- **AN-02 · P0 · Resultados esperados** — `backend/src/test/resources/esperados.json` a partir do §6.5
  + teste de integração que roda todos os âncoras.
- **AN-03 · P0 · Categorização, renda e fluxo de caixa** (§7.1–7.3) com testes unitários.
- **AN-04 · P0 · Score de principalidade** (§7.4) com `contribuicoes`, `destaques` e `explicacao`.
- **AN-05 · P0 · Alertas** (§7.5–7.7), incluindo conglomerado e exposição sem garantia.
- **AN-06 · P0 · Prioridade** (§7.9) com `motivos`.
- **AN-07 · P0 · Calibração** — ajustar pesos no `application.yml` até a fila bater com o roteiro.
- **AN-08 · P1 · `docs/pitch-numeros.md`** — números de impacto com premissas explícitas
  (horas economizadas por assessor, patrimônio fora visível, taxa de consentimento).
- **AN-09 · P2 · Simulador de deságio** (§7.11).

### BE2 — Inteligência e agentes
- **BE2-01 · P0 · Spike Embabel (timebox 60 min)** — agente "olá" chamando Claude; se falhar, Spring AI.
- **BE2-02 · P0 · `Copiloto` + modos** stub/cache/record/live + `ContextoClienteFactory`.
- **BE2-03 · P0 · Próximas melhores ações** (§7.8).
- **BE2-04 · P0 · Fila** — `FilaService` usando `PrioridadeService` (analista) e a ação principal.
- ~~BE2-05 · Jornada~~ — **removido no reescopo** (sem gamificação).
- **BE2-06 · P0 · AgenteMensagemCliente** + endpoint.
- **BE2-07 · P0 · Gravar o cache da demo** — rodar em `record` para todas as ações dos âncoras (inclui
  a mensagem de convite da Marina);
  commitar `backend/llm-cache/`. Fazer antes do freeze.
- **BE2-08 · P1 · AgenteBriefing.**
- **BE2-09 · P2 · AgenteNotaPosReuniao** (+ persistir eventos criados).
- **BE2-10 · P2 · Radar de notícias** — feito (ver `docs/radar.md`).
- **BE2-11 · P0 · Mensagem de convite** — contexto de `CONVIDAR_CONEXAO` com o link; stub e cache.

### FE1 — Assessor
- **FE1-01 · P0 · Base do frontend** (§9.1), rodando com mocks.
- **FE1-02 · P0 · Layout do assessor** e navegação.
- **FE1-03 · P0 · Fila "Hoje".**
- **FE1-04 · P0 · 360: cabeçalho, cobertura, patrimônio.**
- **FE1-05 · P0 · Card de principalidade.**
- **FE1-06 · P0 · Alertas, ações e dialog de mensagem.**
- **FE1-07 · P0 · Modo ao vivo** (polling) + destaque NOVO animado.
- **FE1-08 · P1 · Painel da carteira.**
- **FE1-09 · P1 · Briefing pré-reunião.**
- **FE1-10 · P2 · Nota de áudio** e **FE1-11 · P2 · Calculadora de deságio.**
- **FE1-12 · P0 · Enviar convite** na 360 + status do convite.

### FE2 — Palco, convite e pitch
- **FE2-10 · P0 · `/convite/[token]`** — tela única de confirmação.
- **FE2-05 · P0 · `/palco`** com WhatsApp simulado, "Simular confirmação" e reset.
- **FE2-11 · P0 · Limpeza** — remover `app/cliente/**`, `components/cliente/*`, `mocks/jornada.ts`,
  `useJornada` e testes associados; regenerar tipos.
- **FE1-08 · P1 · Painel da carteira** — assumido pelo FE2 para aliviar o FE1.
- **FE2-09 · P1 · Slides e vídeo de backup** (incluir o slide de visão de futuro no app da XP).
- FE2-01..04, 06..08: **removidos no reescopo** (app do cliente e gamificação).

---

## 11. Fases e checkpoints

Ajustem os horários ao cronograma da hackathon. Proporções sobre o tempo restante após a F0.

| Fase | Duração | O que acontece | Saída (checkpoint) |
|---|---|---|---|
| F0 Fundação | ~1h | BE1: BE1-01/02 (push do contrato em ~40 min). FE1: FE1-01. Analista: AN-01. BE2: BE2-01. FE2: palco e convite com fixtures. | **C0:** `openapi.json` + fixtures em `main`; front rodando em mock; contrato v1 congelado (só mudanças aditivas). |
| F1 Núcleo | ~40% | Todos os P0 de dados reais. | **C1:** 360 e fila reais para os 6 âncoras; testes do §6.5 verdes. |
| F2 Fluxo da demo | ~20% | Convidar → confirmar → recalcular → assessor atualiza; `/palco`; mensagem; cache gravado. | **C2:** roteiro do §1 roda 3× seguidas com reset, sem mocks. |
| F3 P1 e polimento | ~20% | P1 por ordem de impacto no pitch. | **C3:** painel, briefing, animações. |
| F4 Freeze e ensaio | ~20% | Só correção de bug. Vídeo de backup. Ensaio ≥ 3×. | **C4:** demo em `copiloto.modo=cache`, offline. |

---

## 12. Riscos e plano B

| Risco | Plano B |
|---|---|
| Embabel não sobe no timebox | `live` com Spring AI `ChatClient`; Embabel vira P1 |
| API do LLM lenta ou fora do ar | modo `cache` (padrão da demo); `stub` como piso |
| Integração atrasada | front em `NEXT_PUBLIC_USE_MOCKS=true` com fixtures antes/depois roda o roteiro inteiro |
| Wi-Fi do evento | tudo local; nenhuma chamada externa no modo `cache` |
| Conflitos de merge | tabela de donos no `CLAUDE.md`; contrato só aditivo |
| Pergunta sobre LGPD/consentimento | consentimento explícito por escopo e prazo, confirmado no ambiente do banco de origem, revogável; dados fictícios; LLM só vê contexto mínimo |
| Pergunta "como saber 67% se não vemos o resto?" | cobertura = instituições **declaradas pelo cliente** que estão conectadas |
| "Cadê a gamificação do Open Finance?" | decisão de foco: o valor está no assessor agir; o incentivo para o cliente conectar é o motivo concreto que o assessor dá ("checar sua proteção no FGC"). Gamificação no app da XP é visão de futuro |
| O cliente não abre o link na demo | botão "Simular confirmação" no palco chama `/convites/{token}/confirmar` |

---

## 13. Configuração de referência (`application.yml`)

```yaml
server:
  port: 8080

demo:
  data-referencia: 2026-10-11        # usar a data do pitch
  assessor-id: ass-001
  janela-alerta-novo-minutos: 10

copiloto:
  modo: stub                         # stub | cache | record | live  (demo: cache)
  modelo: claude-sonnet-5-5
  cache-dir: ./llm-cache

premissas:
  cdi-anual: 0.10                    # ILUSTRATIVO — ajustar para a taxa vigente antes do pitch
  fgc:
    limite-por-conglomerado: 250000
    teto-global: 1000000

principalidade:
  pesos:
    renda: 0.30
    movimentacao: 0.20
    contas-recorrentes: 0.15
    investimentos: 0.15
    cartao: 0.10
    credito: 0.10
  score-minimo-principal: 40

renda:
  meses-minimos: 3
  tolerancia-valor: 0.15

alertas:
  saldo-parado-multiplo-custo: 1
  saldo-parado-minimo: 10000
  renda-fora-capacidade-minima: 2000
  exposicao-sem-garantia-max: 0.20
  exposicao-sem-garantia-alta: 0.35
  vencimento-dias: 30
  consentimento-expirando-dias: 15
  evento-vida-dias: 7
  reserva-meses-alvo: 6

prioridade:
  fgc-base: 35
  fgc-por-20k: 1
  fgc-max-extra: 25
  fgc-teto-global: 10
  concentracao-base: 15
  concentracao-alta-extra: 10
  vencimento-base: 15
  vencimento-por-50k: 1
  vencimento-max-extra: 10
  saldo-parado-base: 10
  saldo-parado-por-10k: 1
  saldo-parado-max-extra: 10
  renda-fora: 10
  consentimento-expirando: 10
  reserva-insuficiente: 8
  evento-vida: 8
  bonus-so-investimentos: 5
```
