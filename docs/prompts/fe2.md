# Prompt — FE2 (palco, convite e pitch)

Cole o bloco abaixo no Claude Code, na raiz do repositório.

```
Você vai implementar a parte FE2 do Copiloto do Assessor (hackathon XP, Grupo 6). O sistema é só do
assessor: não há app do cliente nem gamificação. O cliente só aparece na ponta de um convite de
consentimento Open Finance enviado pelo assessor.

Antes de tudo, leia o CLAUDE.md e o docs/PLAN.md inteiros. Foque em §1 (roteiro da demo — o seu
trabalho é o "uau" do palco), §4.2 (Convite), §5, §7.10 (convites), §9.3, §10 (backlog FE2) e §12.

Seu escopo: FE2-10, FE2-05, FE2-11, FE1-08 (painel) e FE2-09, nesta ordem. Pastas suas:
frontend/src/app/convite/, frontend/src/app/palco/, frontend/src/components/convite/,
frontend/src/components/palco/. Use lib/api.ts e lib/queries.ts do FE1; se faltar algum hook,
adicione de forma mínima e avise no commit.

Use TDD: escreva o teste (Vitest + Testing Library) antes, veja falhar, implemente.

P0:
- FE2-10: /convite/[token] (mobile 390px) — logo fictício do banco, aviso "ambiente simulado",
  escopos, prazo de 12 meses, "você pode revogar quando quiser" → Confirmar compartilhamento →
  "Pronto! Sua assessora já consegue ver seus dados do Banco Horizonte." Trate confirmado (409 é
  sucesso), expirado (410) e inexistente (404).
- FE2-05: /palco — esquerda iframe /assessor/hoje?aoVivo=1 com abas para a 360 da cli-001; direita
  moldura de celular com uma conversa de WhatsApp simulada mostrando o convite da Marina
  (GET /clientes/cli-001/convites) com o link abrindo /convite/[token]; barra superior com
  "Resetar demo" e "Simular confirmação". Precisa caber num projetor 1920x1080.
- FE2-11: limpeza — nada de app/cliente/**, components/cliente/*, jornada, níveis, missões ou
  diagnósticos no frontend.

Critérios de aceite:
- Em modo mock e com backend real: enviar o convite na 360 da Marina, confirmar em /convite/[token]
  (ou "Simular confirmação" no palco) leva a cobertura a 3 de 3, e o lado esquerdo do /palco mostra a
  Marina em 1º com NOVO em até 2s.
- "Resetar demo" volta tudo ao estado inicial sem recarregar a página inteira.
- O fluxo inteiro funciona com o mouse em menos de 30 segundos.

P1 depois: painel da carteira (FE1-08), slides do pitch e vídeo de backup gravado do /palco (FE2-09,
com o analista; incluir o slide de visão de futuro: o convite cai no app da XP).

Não faça: telas do assessor além do que o FE1 pedir, lógica de negócio no front (cobertura,
prioridade e status do convite vêm prontos da API).
```
