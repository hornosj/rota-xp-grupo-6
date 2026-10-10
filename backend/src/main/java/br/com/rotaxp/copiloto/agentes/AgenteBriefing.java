package br.com.rotaxp.copiloto.agentes;

import br.com.rotaxp.copiloto.agentes.AgentesTipos.BriefingRedigido;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.ContextoBriefing;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.PedidoBriefing;
import br.com.rotaxp.copiloto.config.CopilotoProps;
import br.com.rotaxp.copiloto.dominio.Briefing;
import br.com.rotaxp.copiloto.dominio.Enums.GeradoPor;
import com.embabel.agent.api.annotation.AchievesGoal;
import com.embabel.agent.api.annotation.Action;
import com.embabel.agent.api.annotation.Agent;
import com.embabel.agent.api.common.OperationContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;

/** PLAN §8.3 (P1) — PedidoBriefing → ContextoBriefing (sem LLM) → Briefing (LLM: 5 tópicos + 3 perguntas). */
@Agent(description = "Prepara o briefing pré-reunião do assessor")
public class AgenteBriefing {

    private final ContextoClienteFactory contextos;
    private final CopilotoProps props;
    private final ObjectMapper mapper;

    public AgenteBriefing(ContextoClienteFactory contextos, CopilotoProps props, ObjectMapper mapper) {
        this.contextos = contextos;
        this.props = props;
        this.mapper = mapper;
    }

    @Action(description = "Monta o contexto enxuto do cliente, sem LLM")
    public ContextoBriefing montarContexto(PedidoBriefing pedido) {
        return new ContextoBriefing(contextos.paraCliente(pedido.clienteId()));
    }

    @AchievesGoal(description = "Briefing com 5 tópicos e 3 perguntas para a reunião")
    @Action(description = "Redige o briefing com o LLM")
    public Briefing redigir(ContextoBriefing c, OperationContext ctx) {
        BriefingRedigido r = ctx.ai().withLlm(new com.embabel.common.ai.model.LlmOptions(null, props.modelo()).withMaxTokens(props.maxTokens()))
                .withSystemPrompt(Prompts.BRIEFING)
                .createObject("Contexto do cliente (JSON):\n" + Prompts.contexto(mapper, c.contexto()), BriefingRedigido.class);
        return new Briefing(c.contexto().clienteId(), lista(r.bullets()), lista(r.perguntasSugeridas()), GeradoPor.live);
    }

    private static List<String> lista(List<String> l) {
        return l == null ? List.of() : List.copyOf(l);
    }
}
