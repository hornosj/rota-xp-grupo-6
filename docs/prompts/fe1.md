# Prompt — FE1 (base do frontend e telas do assessor)

Cole o bloco abaixo no Claude Code, na raiz do repositório.

```
Você vai implementar a parte FE1 do Copiloto do Assessor (hackathon XP, Grupo 6).

Antes de tudo, leia o CLAUDE.md e o docs/PLAN.md inteiros. Foque em §1, §4.2, §5, §7.4 (para
entender o card de principalidade), §9.1, §9.2, §10 (backlog FE1) e §12.

Seu escopo: FE1-01 a FE1-11, nesta ordem. Pastas suas: frontend/ (setup), frontend/src/lib/,
frontend/src/components/ui/, frontend/src/app/assessor/, frontend/src/components/assessor/.
A área do cliente e o /palco são do FE2: não mexa lá.

Comece em modo de planejamento: mostre o plano do FE1-01. Depois de eu aprovar, implemente.

FE1-01 em duas entregas:
a) EM ATÉ 20 MINUTOS: create-next-app (Next.js 16, TypeScript strict, App Router, Tailwind,
   ESLint, src/), shadcn/ui com os componentes do §9.1, TanStack Query provider, rewrite de
   /api/:path* para BACKEND_URL, página / com links placeholder. Commit em main — o FE2 depende disso.
b) Depois: scripts gen:api, sync:fixtures e typecheck; lib/api.ts com uma função tipada por
   endpoint e o modo NEXT_PUBLIC_USE_MOCKS=true lendo src/mocks (conceder troca a Marina para a
   fixture "depois"); lib/queries.ts com os hooks do §9.1 (modo ao vivo com refetchInterval 2000);
   lib/formato.ts. Se o contract/openapi.json ainda não existir, escreva os tipos provisórios a
   partir do §4.2 e troque pelo gerado assim que o BE1 fizer o commit "contrato v1".

FE1-02 a FE1-07 (P0): layout do assessor, fila "Hoje", 360 com cabeçalho, cobertura,
patrimônio, card de principalidade (barras por instituição com segmentos por componente usando
`contribuicoes`), alertas, ações com dialog de mensagem (copiar e abrir no WhatsApp), modo ao vivo
com destaque NOVO animado. Siga o §9.2.

Design: profissional e limpo, números grandes, BRL formatado, vermelho só para severidade ALTA,
estados de loading com skeleton, nenhuma tela quebra se uma lista vier vazia.

Critérios de aceite:
- npm run typecheck e npm run lint verdes.
- Em modo mock, /assessor/hoje mostra a Marina em 2º; depois de chamar conceder (pode testar
  pelo console ou pela tela do cliente quando existir), ela aparece em 1º com tag NOVO em até 2s
  no modo ao vivo.
- Com o backend rodando (USE_MOCKS=false), as mesmas telas funcionam com dados reais.

P1/P2 depois: painel da carteira (FE1-08), briefing (FE1-09), nota de áudio com Web Speech API
pt-BR e fallback de texto (FE1-10), calculadora de deságio (FE1-11).

Não faça: estado global além do TanStack Query, chamadas diretas ao :8080 (use /api), editar
tipos gerados à mão depois que o gen:api existir.
```
