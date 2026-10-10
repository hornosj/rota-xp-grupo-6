# Copiloto do Assessor — Hackathon XP (Grupo 6)

Transforma dados de Open Finance em **motivos para ligar**: identifica a **principalidade** (onde a XP está
na vida financeira do cliente) e usa a **gamificação do Open Finance** para o cliente conectar mais instituições.
Escopo, contrato e algoritmos: [`docs/PLAN.md`](docs/PLAN.md). Regras do time: [`CLAUDE.md`](CLAUDE.md).

## Como rodar

Pré-requisitos: Java 21, Node 20+ (testado com 25), Python 3.9+ (só para regenerar a seed).

```bash
# 1. Backend (porta 8080) — Swagger em http://localhost:8080/swagger-ui.html
cd backend && ./mvnw spring-boot:run

# 2. Frontend (porta 3000) — /api/* é reescrito para o backend
cd frontend && npm install && npm run dev
```

Abra **http://localhost:3000/palco** para a demo (assessora à esquerda, celular da Marina à direita).

- Sem backend: `NEXT_PUBLIC_USE_MOCKS=true npm run dev` (plano B — roda o roteiro inteiro com fixtures).
- Resetar a demo: botão "Resetar demo" no `/palco` ou `curl -X POST localhost:8080/api/demo/reset`.

## Testes

| Parte | Comando | O que cobre |
|---|---|---|
| Backend | `cd backend && ./mvnw test` | regras da `analise` (unitários), jornada, ações, Copiloto (stub/cache/record/live com LLM falso) e integração com a seed real: todos os âncoras do §6.5 (`src/test/resources/esperados.json`) e o roteiro da demo pela API |
| Frontend | `cd frontend && npm test && npm run typecheck && npm run lint` | formatação, camada de API/mocks, hooks, telas do assessor, do cliente e do palco |
| Dados | `python -m unittest discover -s data/tests` | gerador da seed e o checker de referência das regras |

Tudo foi desenvolvido com TDD.

## Seed

```bash
python data/gerar_seed.py --data-referencia 2026-10-11 --saida backend/src/main/resources/seed
python data/checar_seed.py            # imprime os números de cada âncora e confere com o §6.5
```

Use a data do pitch em `--data-referencia` **e** em `demo.data-referencia` (`backend/src/main/resources/application.yml`).

## Copiloto (IA)

`copiloto.modo` (ou a variável `COPILOTO_MODO`): `stub | cache | record | live`.

- `stub` — templates determinísticos, sem chave de API (padrão).
- `live` — Claude via Messages API; chave em `ANTHROPIC_API_KEY` (nunca commitar). Modelo em `copiloto.modelo`.
- `record` — `live` + grava as respostas em `backend/llm-cache/`.
- `cache` — **modo da demo**: lê `llm-cache/`; o que faltar cai no `stub`. Nenhuma chamada externa.
- `live`/`record` sem chave viram `stub` automaticamente. Qualquer falha do LLM também cai no `stub`.

Para gravar o cache antes do freeze (BE2-07): suba com `COPILOTO_MODO=record` e a chave, percorra as
ações dos âncoras (antes e depois do consentimento da Marina) e commite `backend/llm-cache/`.

## Contrato

`contract/openapi.json` e `contract/fixtures/` são exportados da API real:

```bash
curl -s localhost:8080/v3/api-docs > contract/openapi.json
cd frontend && npm run gen:api && npm run sync:fixtures
```

## Desvios do plano (decididos durante a implementação)

- **Spring Boot 3.5.16** escrito à mão no `pom.xml` (o Initializr já não oferece 3.5).
- **Modo `live` com HTTP direto na Messages API** (`AnthropicLlmCliente`), atrás da interface `LlmCliente`,
  em vez de Embabel — sem chave de API não dava para validar o agente Embabel; fica como P1 (o plano prevê
  esse plano B no §8.3/§12).
- Regras ambíguas resolvidas como no checker de referência (`data/checar_seed.py`): `SO_INVESTIMENTOS` é
  avaliado antes de `PRINCIPAL`; reserva arredondada a 1 casa (HALF_EVEN); janelas de movimentação e contas
  recorrentes = 3 meses; `FATURA CARTAO <X>` casa com a última palavra do nome do banco.
- `Diagnostico.detalhes` usa as chaves que o front lê: PROTECAO_FGC `{valorSemCobertura, instituicao, conglomerados}`,
  CUSTO_DE_VIDA `{total, categorias, parcial}`, RESERVA_EMERGENCIA `{meses, liquidezImediata, metaMeses, meta}`.

Dados 100% fictícios (bancos Aurora, Horizonte, Ipê). XP é a única marca real.
