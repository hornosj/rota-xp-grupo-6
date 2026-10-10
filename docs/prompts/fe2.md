# Prompt — FE2 (jornada gamificada do cliente, palco e pitch)

Cole o bloco abaixo no Claude Code, na raiz do repositório.

```
Você vai implementar a parte FE2 do Copiloto do Assessor (hackathon XP, Grupo 6).

Antes de tudo, leia o CLAUDE.md e o docs/PLAN.md inteiros. Foque em §1 (roteiro da demo — o seu
trabalho é o "uau"), §4.2 (Jornada, Missao, Diagnostico, Consentimento), §5, §7.10, §9.3, §10
(backlog FE2) e §12.

Seu escopo: FE2-01 a FE2-09, nesta ordem. Pastas suas: frontend/src/app/cliente/,
frontend/src/app/palco/, frontend/src/components/cliente/. Use lib/api.ts e lib/queries.ts do FE1;
se faltar algum hook, adicione de forma mínima e avise no commit.

Comece em modo de planejamento: mostre o plano do FE2-01 a FE2-03. Depois de eu aprovar, implemente.

Enquanto a base do frontend (FE1-01a) não estiver em main: crie em frontend/src/components/cliente/
os componentes puros com props tipadas a partir do §4.2 (AnelCompletude, ChipNivel, CardMissao,
CardDiagnostico, MolduraCelular) — sem depender de dados — e integre quando a base chegar.

P0:
- FE2-01: layout mobile first (390px) e MolduraCelular.
- FE2-02: /cliente/[id] com saudação, anel de completude ("Seu patrimônio: 67% visível"), nível e
  "como subir", missões.
- FE2-03: /cliente/[id]/conectar/[instituicaoId] em 4 passos (§9.3), deixando claro que a tela do
  banco é uma simulação. O passo final chama conceder e invalida as queries.
- FE2-04: diagnósticos bloqueados (cadeado + requisito) e desbloqueados (resumo), detalhe do FGC.
- FE2-05: /palco — esquerda iframe /assessor/hoje?aoVivo=1 com abas para a 360 da cli-001,
  direita MolduraCelular com iframe /cliente/cli-001, botão "Resetar demo" (POST /api/demo/reset e
  recarrega os iframes). Precisa caber num projetor 1920x1080.

Critérios de aceite:
- Em modo mock e com backend real: na cli-001, conectar o Banco Horizonte leva a completude a
  100%, o nível de 2 para 3, desbloqueia "Proteção FGC" com R$ 400 mil, e o lado esquerdo do
  /palco atualiza sozinho em até 2s.
- "Resetar demo" volta tudo ao estado inicial sem recarregar a página inteira.
- O fluxo inteiro funciona com o mouse em menos de 30 segundos (é o tempo dele no pitch).

P1 depois: animações de subida de nível e desbloqueio com confete (FE2-06), consentimentos e
revogação (FE2-07, mostra LGPD na prática), detalhe de custo de vida e reserva (FE2-08), slides do
pitch e vídeo de backup gravado do /palco (FE2-09, com o analista).

Guardrail de produto: a gamificação premia consentimento e saúde financeira, nunca operar mais ou
assumir mais risco. Textos em pt-BR, tom acolhedor, sem jargão.

Não faça: telas do assessor (FE1), lógica de negócio no front (completude, níveis e diagnósticos
vêm prontos da API).
```
