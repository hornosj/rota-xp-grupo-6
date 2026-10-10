package br.com.rotaxp.copiloto.agentes;

import br.com.rotaxp.copiloto.agentes.AgentesTipos.ContextoMensagem;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.MensagemRedigida;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.PedidoMensagem;
import br.com.rotaxp.copiloto.config.CopilotoProps;
import br.com.rotaxp.copiloto.dominio.Enums.GeradoPor;
import br.com.rotaxp.copiloto.dominio.MensagemGerada;
import com.embabel.agent.api.annotation.AchievesGoal;
import com.embabel.agent.api.annotation.Action;
import com.embabel.agent.api.annotation.Agent;
import com.embabel.agent.api.common.OperationContext;
import com.fasterxml.jackson.databind.ObjectMapper;

/** PLAN §8.3 — PedidoMensagem → ContextoMensagem (sem LLM) → MensagemGerada (LLM, saída estruturada). */
@Agent(description = "Redige a mensagem do assessor para o cliente sobre uma ação sugerida")
public class AgenteMensagemCliente {

    private final ContextoClienteFactory contextos;
    private final CopilotoProps props;
    private final ObjectMapper mapper;

    public AgenteMensagemCliente(ContextoClienteFactory contextos, CopilotoProps props, ObjectMapper mapper) {
        this.contextos = contextos;
        this.props = props;
        this.mapper = mapper;
    }

    @Action(description = "Monta o contexto enxuto do cliente e da ação, sem LLM")
    public ContextoMensagem montarContexto(PedidoMensagem pedido) {
        return new ContextoMensagem(contextos.paraAcao(pedido.clienteId(), pedido.acaoId()), pedido.canal());
    }

    @AchievesGoal(description = "Mensagem pronta para o assessor enviar ao cliente")
    @Action(description = "Redige a mensagem com o LLM")
    public MensagemGerada redigir(ContextoMensagem c, OperationContext ctx) {
        MensagemRedigida r = ctx.ai().withLlm(props.modelo())
                .withSystemPrompt(Prompts.MENSAGEM)
                .createObject("Canal: " + c.canal() + "\nContexto do cliente (JSON):\n" + Prompts.contexto(mapper, c.contexto())
                        + "\nEscreva a mensagem do assessor para o cliente sobre a ação sugerida.", MensagemRedigida.class);
        return new MensagemGerada(r.texto().strip(), c.canal(), GeradoPor.live);
    }
}
