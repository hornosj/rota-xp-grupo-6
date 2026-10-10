package br.com.rotaxp.copiloto.agentes;

import br.com.rotaxp.copiloto.agentes.AgentesTipos.ContextoNoticia;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.MotivoRedigido;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.PedidoMotivoNoticia;
import br.com.rotaxp.copiloto.config.CopilotoProps;
import br.com.rotaxp.copiloto.dominio.Enums.GeradoPor;
import br.com.rotaxp.copiloto.dominio.Radar.MotivoNoticia;
import com.embabel.agent.api.annotation.AchievesGoal;
import com.embabel.agent.api.annotation.Action;
import com.embabel.agent.api.annotation.Agent;
import com.embabel.agent.api.common.OperationContext;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Radar (BE2-10): PedidoMotivoNoticia → ContextoNoticia (sem LLM) → MotivoNoticia (LLM).
 * O texto é para o assessor (por que ligar e o que conversar), não uma recomendação ao cliente.
 */
@Agent(description = "Explica ao assessor por que uma notícia é motivo de contato com o cliente")
public class AgenteRadarNoticias {

    private final ContextoNoticiaFactory contextos;
    private final CopilotoProps props;
    private final ObjectMapper mapper;

    public AgenteRadarNoticias(ContextoNoticiaFactory contextos, CopilotoProps props, ObjectMapper mapper) {
        this.contextos = contextos;
        this.props = props;
        this.mapper = mapper;
    }

    @Action(description = "Junta cliente, notícia e impacto calculado, sem LLM")
    public ContextoNoticia montarContexto(PedidoMotivoNoticia pedido) {
        return contextos.para(pedido.clienteId(), pedido.noticiaId());
    }

    @AchievesGoal(description = "Motivo de contato pronto para o assessor")
    @Action(description = "Redige o motivo de contato com o LLM")
    public MotivoNoticia redigir(ContextoNoticia c, OperationContext ctx) {
        MotivoRedigido r = ctx.ai().withLlm(new com.embabel.common.ai.model.LlmOptions(null, props.modelo()).withMaxTokens(props.maxTokens()))
                .withSystemPrompt(Prompts.MOTIVO_NOTICIA)
                .createObject("Notícia e impacto na carteira (JSON):\n" + json(c), MotivoRedigido.class);
        return new MotivoNoticia(r.texto().strip(), GeradoPor.live);
    }

    private String json(ContextoNoticia c) {
        try {
            return mapper.writerWithDefaultPrettyPrinter().writeValueAsString(c);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }
}
