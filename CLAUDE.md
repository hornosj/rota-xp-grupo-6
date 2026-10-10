# Copiloto do Assessor — Hackathon XP (Grupo 6)

Plataforma para assessores de investimento. Tese: transformar dados espalhados (Open Finance) em
**motivos para ligar**, com foco em **identificação de principalidade** e **gamificação do Open Finance**.

- Plano completo, contrato e algoritmos: `docs/PLAN.md` (fonte da verdade de escopo).
- Prompt de cada papel: `docs/prompts/<papel>.md`.
- Em caso de dúvida entre este arquivo e o PLAN, o PLAN vence; se o PLAN for ambíguo, pergunte antes de inventar.

## Stack

- **Backend:** Java 21, Spring Boot 3.5.x, Maven (com wrapper), springdoc-openapi.
  Agentes com **Embabel 1.0** (que roda sobre Spring AI 1.1.x e Spring Boot 3.5.x).
  Não usar Spring Boot 4 enquanto o Embabel usado não suportar oficialmente.
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS v4, shadcn/ui,
  TanStack Query v5, Recharts, openapi-typescript para gerar tipos.
- **Dados:** JSON sintético em `backend/src/main/resources/seed/`, gerado por `data/gerar_seed.py`
  (Python 3, só biblioteca padrão). **Sem banco de dados:** repositórios em memória.
- **LLM:** Claude via API. Chave em `ANTHROPIC_API_KEY` (variável de ambiente; nunca commitar).

## Estrutura e donos

| Caminho | Dono |
|---|---|
| `contract/` (openapi.json, fixtures) | BE1 — mudanças só aditivas e avisadas no grupo |
| `backend/.../dominio`, `openfinance`, `consolidacao`, `demo` | BE1 |
| `backend/.../analise` | Analista (BE1 revisa) |
| `backend/.../inteligencia`, `backend/.../agentes` | BE2 |
| `backend/.../api` | BE1 e BE2, cada um nos seus controllers |
| `data/`, `backend/src/test/resources/esperados.json` | Analista |
| `frontend/src/app/assessor/**`, `frontend/src/components/assessor/**` | FE1 |
| `frontend/src/app/cliente/**`, `frontend/src/app/palco/**`, `frontend/src/components/cliente/**` | FE2 |
| `frontend/src/lib/**`, `frontend/src/components/ui/**` | FE1 cria no setup; ambos editam com cuidado |

Não edite fora da sua área sem necessidade. Se precisar, faça a mudança mínima e diga no commit.

## Comandos

- Backend: `cd backend && ./mvnw spring-boot:run` (porta 8080) · testes: `./mvnw test`
- Exportar contrato: com o backend rodando, `curl -s localhost:8080/v3/api-docs > contract/openapi.json`
- Frontend: `cd frontend && npm run dev` (porta 3000; `/api/*` é reescrito para o backend)
  · `npm run gen:api` (tipos a partir de `contract/openapi.json`) · `npm run lint` · `npm run typecheck`
- Seed: `python3 data/gerar_seed.py --data-referencia 2026-10-10 --saida backend/src/main/resources/seed`
- Resetar a demo: `curl -X POST localhost:8080/api/demo/reset`

## Regras

1. **Contrato primeiro.** Tipos e endpoints estão no PLAN §4–5. Backend e frontend seguem o
   `contract/openapi.json`. Mudança de contrato: só aditiva, commit próprio, aviso no grupo.
2. **Determinismo.** Nada de `LocalDate.now()` espalhado: injete `DataReferencia` (lê
   `demo.data-referencia`). Seed determinística (`random.seed(42)`).
3. **LLM redige, não calcula.** Todo número vem da camada `analise`. O LLM só recebe um contexto
   já calculado e escreve texto.
4. **LLM sempre atrás da interface `Copiloto`** com modos `stub | cache | record | live`.
   Sem chave de API, o modo `stub` precisa funcionar. A demo roda em `cache`.
5. **Parâmetros em `application.yml`:** pesos, limites, premissas (FGC, CDI, janelas de dias).
   Nunca hard-coded.
6. **Testes:** toda regra de `analise` tem teste unitário. Os casos-âncora (PLAN §6) viram testes
   de integração que precisam passar antes de qualquer merge em `main`.
7. **Dinheiro:** `BigDecimal` no Java (escala 2, `RoundingMode.HALF_EVEN`), número em reais no JSON,
   formatação BRL no front (`Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`).
   Percentuais no JSON como fração 0–1; scores como 0–100.
8. **Idioma:** UI e textos em pt-BR. Identificadores de domínio em português sem acento
   (`Cliente`, `Consentimento`, `Principalidade`); termos técnicos em inglês são ok.
9. **Dados 100% fictícios.** Bancos fictícios (Aurora, Horizonte, Ipê). XP é a única marca real.
10. **Git:** branch `<papel>/<tarefa>`, commits pequenos, `git pull --rebase origin main` com
    frequência, testes e typecheck verdes antes de mergear.
11. **Prioridade:** P0 > P1 > P2. Não comece P2 com P0 quebrado. O fluxo da demo (PLAN §1) é sagrado.
