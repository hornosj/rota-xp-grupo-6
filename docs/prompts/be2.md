# Prompt — BE2 (inteligência e agentes)

Cole o bloco abaixo no Claude Code, na raiz do repositório.

```
Você vai implementar a parte BE2 do Copiloto do Assessor (hackathon XP, Grupo 6).

Antes de tudo, leia o CLAUDE.md e o docs/PLAN.md inteiros. Foque em §1, §4.2, §5, §7.8, §7.10,
§8 (camada de IA), §10 (backlog BE2), §12 e §13.

Seu escopo: BE2-01 a BE2-10, nesta ordem. Pastas suas: backend/.../inteligencia/,
backend/.../agentes/, backend/llm-cache/ e os controllers de fila, jornada, mensagem, briefing e notas.

Comece em modo de planejamento: mostre o plano do BE2-01 e BE2-02. Depois de eu aprovar, implemente.

BE2-01 — Spike do Embabel (TIMEBOX 60 MINUTOS, começa já, em paralelo ao bootstrap do BE1):
- Embabel 1.0 roda com Java 21, Spring Boot 3.5.x e Spring AI 1.1.x.
- Antes de adicionar dependências, confirme no Maven Central as coordenadas exatas do starter do
  Embabel para Anthropic (grupo com.embabel.agent) e, na documentação oficial, a propriedade de
  modelo padrão. Não chute coordenadas.
- Objetivo: um @Agent com uma @Action @AchievesGoal que recebe um record e devolve um record via
  Claude (modelo claude-sonnet-5-5, chave em ANTHROPIC_API_KEY), chamado a partir de um serviço
  Spring, com um teste usando FakeOperationContext.
- Se não funcionar em 60 minutos: pare, me avise e implemente o modo live com Spring AI ChatClient
  (mesma versão que o Embabel puxa). Embabel vira P1.
- Faça o spike num branch be2/spike-embabel. Só traga para o backend principal depois que o BE1
  tiver feito o commit "contrato v1".

BE2-02 a BE2-07 (depois do contrato v1):
- Interface Copiloto e os modos stub | cache | record | live exatamente como no §8.1. O stub tem
  um template bom para cada TipoAcao e cita eventos de vida próximos.
- ContextoClienteFactory (§8.2): o LLM só vê o contexto enxuto; nunca calcula números.
- AcaoSugeridaService (§7.8), FilaService (usa o PrioridadeService do analista; até ele existir,
  use uma implementação provisória com a mesma assinatura), JornadaService (§7.10).
- AgenteMensagemCliente (§8.3) com as regras de prompt do §8.3.
- BE2-07: rode em modo record para todas as ações dos 6 âncoras (antes e depois do consentimento
  da Marina) e commite backend/llm-cache/. Com copiloto.modo=cache e sem internet, a demo inteira
  precisa funcionar.

Critérios de aceite:
- Sem ANTHROPIC_API_KEY, com modo stub, todos os endpoints de IA respondem.
- Jornada da cli-001: completude 0.667 e nível 2 antes; 1.0 e nível 3 depois de conceder
  inst-horizonte, com PROTECAO_FGC desbloqueado e resumo citando R$ 400 mil.
- Jornada da cli-003: CUSTO_DE_VIDA bloqueado até conceder inst-aurora.
- A mensagem para a ação DIVERSIFICAR_FGC da Marina cita o valor e o aniversário da Sofia, sem
  prometer rentabilidade.

P1/P2 depois: AgenteBriefing (BE2-08), AgenteNotaPosReuniao (BE2-09), radar de notícias (BE2-10).

Não faça: o LLM calcular ou inventar valores; chamadas de LLM no caminho da fila ou da 360
(só nos endpoints de mensagem, briefing e notas); commitar a chave de API.
```
