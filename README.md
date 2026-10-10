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

Abra **http://localhost:3000** para a demo (fila do assessor, visão 360 e cadastro de investidores).

- Sem backend: `NEXT_PUBLIC_USE_MOCKS=true npm run dev` (plano B — roda o roteiro inteiro com fixtures).
- Resetar a demo: `curl -X POST localhost:8080/api/demo/reset`.

## Testes

| Parte | Comando | O que cobre |
|---|---|---|
| Backend | `cd backend && ./mvnw test` | regras da `analise` (unitários), ações, convites, onboarding, radar, Copiloto (stub/cache/record/live com LLM falso) e integração com a seed real: todos os âncoras do §6.5 (`src/test/resources/esperados.json`) e o roteiro da demo pela API |
| Frontend | `cd frontend && npm test && npm run typecheck && npm run lint` | formatação, camada de API/mocks, hooks, telas do assessor, do convite e do onboarding |
| Dados | `python -m unittest discover -s data/tests` | gerador da seed e o checker de referência das regras |

Tudo foi desenvolvido com TDD.

## Seed

```bash
python data/gerar_seed.py --data-referencia 2026-10-10 --saida backend/src/main/resources/seed
python data/checar_seed.py            # imprime os números de cada âncora e confere com o §6.5
```

Use a data do pitch em `--data-referencia` **e** em `demo.data-referencia` (`backend/src/main/resources/application.yml`).

## Banco de dados (SQLite)

O backend guarda os dados em SQLite (`backend/copiloto.db`, fora do git). Esquema: `backend/src/main/resources/db/schema.sql`.

- No startup o esquema é criado e, se o banco estiver vazio, a seed JSON é importada.
- Consentimentos concedidos/revogados, eventos de vida criados pela nota pós-reunião e o registro de quando cada
  alerta foi detectado (tabela `registro_alerta`) **persistem entre reinícios**.
- `POST /api/demo/reset` apaga tudo, reimporta a seed e limpa o registro de alertas. Depois de regenerar a seed, rode o reset (ou apague o `.db`).
- Mudou o `schema.sql`? Apague o `copiloto.db` — não há migração.
- Configuração: `BANCO_ARQUIVO` (caminho do arquivo), `BANCO_TIPO=memoria` (volta ao repositório em memória),
  `banco.recriar-no-inicio: true` (reimporta a seed a cada startup).
- Os testes de integração usam um banco descartável em `backend/target/copiloto-test.db`.

## Copiloto (IA)

Agentes **Embabel 1.0** (`AgenteMensagemCliente`, `AgenteBriefing`, `AgenteNotaPosReuniao`) chamando um modelo
via **OpenRouter** (provedor compatível com OpenAI). Modelo padrão: `deepseek/deepseek-v4-pro` (barato para testes;
troque com `COPILOTO_MODELO`). Chave em `OPENROUTER_APIKEY` — precisa ser uma chave **de API comum**, não a de
gerenciamento (provisioning), que não chama modelos.

`copiloto.modo` (ou a variável `COPILOTO_MODO`): `stub | cache | record | live`.

- `stub` — templates determinísticos, sem chave de API (padrão).
- `live` — agentes Embabel → OpenRouter.
- `record` — `live` + grava as respostas em `backend/llm-cache/`.
- `cache` — **modo da demo**: lê `llm-cache/`; o que faltar cai no `stub`. Nenhuma chamada externa.
- `live`/`record` sem chave viram `stub` automaticamente. Qualquer falha do agente também cai no `stub`.

Sem chave a aplicação sobe normalmente (o Embabel recebe uma chave provisória e as chamadas caem no stub).

Teste real contra o OpenRouter (opt-in, custa frações de centavo):

```bash
./mvnw test -Dtest=CopilotoLiveOpenRouterTest -Dcopiloto.teste-live=true
```

Para gravar o cache antes do freeze (BE2-07): suba com `COPILOTO_MODO=record`, percorra as ações dos âncoras
(antes e depois do consentimento da Marina) e commite `backend/llm-cache/`.

## Contrato

`contract/openapi.json` e `contract/fixtures/` são exportados da API real:

```bash
curl -s localhost:8080/v3/api-docs > contract/openapi.json
cd frontend && npm run gen:api && npm run sync:fixtures
```

## Desvios do plano (decididos durante a implementação)

- **Spring Boot 3.5.16** escrito à mão no `pom.xml` (o Initializr já não oferece 3.5).
- **LLM via OpenRouter** (`embabel-agent-starter-openai-custom`) em vez do starter Anthropic, com modelo
  barato (DeepSeek) para testes. Os agentes ficam atrás de `ExecutorAgentes`, testados com `FakeOperationContext`.
- Regras ambíguas resolvidas como no checker de referência (`data/checar_seed.py`): `SO_INVESTIMENTOS` é
  avaliado antes de `PRINCIPAL`; reserva arredondada a 1 casa (HALF_EVEN); janelas de movimentação e contas
  recorrentes = 3 meses; `FATURA CARTAO <X>` casa com a última palavra do nome do banco.

Dados 100% fictícios (bancos Aurora, Horizonte, Ipê). XP é a única marca real.
