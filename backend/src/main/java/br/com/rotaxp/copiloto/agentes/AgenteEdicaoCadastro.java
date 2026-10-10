package br.com.rotaxp.copiloto.agentes;

import br.com.rotaxp.copiloto.agentes.AgentesTipos.CamposDitos;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.ContextoEdicao;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.PedidoEdicao;
import br.com.rotaxp.copiloto.config.CopilotoProps;
import br.com.rotaxp.copiloto.dominio.Edicao.CamposExtraidos;
import br.com.rotaxp.copiloto.dominio.Enums.GeradoPor;
import com.embabel.agent.api.annotation.AchievesGoal;
import com.embabel.agent.api.annotation.Action;
import com.embabel.agent.api.annotation.Agent;
import com.embabel.agent.api.common.OperationContext;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Edição do cadastro por voz — PedidoEdicao → ContextoEdicao (sem LLM) → CamposExtraidos (LLM).
 * Validar, comparar com o cadastro e gravar fica com as regras (inteligencia.RegrasCadastro).
 */
@Agent(description = "Entende o que o assessor disse sobre o cadastro do cliente e extrai os campos que mudaram")
public class AgenteEdicaoCadastro {

    private final ContextoClienteFactory contextos;
    private final CopilotoProps props;
    private final ObjectMapper mapper;

    public AgenteEdicaoCadastro(ContextoClienteFactory contextos, CopilotoProps props, ObjectMapper mapper) {
        this.contextos = contextos;
        this.props = props;
        this.mapper = mapper;
    }

    @Action(description = "Monta o cadastro atual e a transcrição, sem LLM")
    public ContextoEdicao montarContexto(PedidoEdicao pedido) {
        return new ContextoEdicao(contextos.cadastro(pedido.clienteId()), pedido.transcricao());
    }

    @AchievesGoal(description = "Campos do cadastro que a fala do assessor muda")
    @Action(description = "Extrai com o LLM os campos que o assessor disse que mudaram")
    public CamposExtraidos extrair(ContextoEdicao c, OperationContext ctx) {
        CamposDitos d = ctx.ai().withLlm(new com.embabel.common.ai.model.LlmOptions(null, props.modelo()).withMaxTokens(props.maxTokens()))
                .withSystemPrompt(Prompts.EDICAO)
                .createObject("Cadastro atual (JSON):\n" + Prompts.json(mapper, c.cadastro())
                        + "\nTranscrição do áudio do assessor:\n" + c.transcricao(), CamposDitos.class);
        return new CamposExtraidos(d.nome(), d.idade(), d.profissao(), d.cidade(), d.perfil(), GeradoPor.live);
    }
}
