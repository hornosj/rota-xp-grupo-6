package br.com.rotaxp.copiloto.agentes;

import br.com.rotaxp.copiloto.agentes.AgentesTipos.ContextoNota;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.EventoExtraido;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.FatosExtraidos;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.NotaReuniao;
import br.com.rotaxp.copiloto.config.CopilotoProps;
import br.com.rotaxp.copiloto.dominio.AcaoSugerida;
import br.com.rotaxp.copiloto.dominio.Enums.GeradoPor;
import br.com.rotaxp.copiloto.dominio.Enums.OrigemEvento;
import br.com.rotaxp.copiloto.dominio.Enums.TipoAcao;
import br.com.rotaxp.copiloto.dominio.Enums.TipoEventoVida;
import br.com.rotaxp.copiloto.dominio.EventoVida;
import br.com.rotaxp.copiloto.dominio.ResultadoNota;
import com.embabel.agent.api.annotation.AchievesGoal;
import com.embabel.agent.api.annotation.Action;
import com.embabel.agent.api.annotation.Agent;
import com.embabel.agent.api.common.OperationContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * PLAN §8.3 (P2) — NotaReuniao → ContextoNota (sem LLM) → FatosExtraidos (LLM) → ResultadoNota (regras).
 * A persistência dos eventos fica no NotaService.
 */
@Agent(description = "Extrai fatos de uma nota pós-reunião e planeja o follow-up")
public class AgenteNotaPosReuniao {

    static final int DIAS_EVENTO_SEM_DATA = 180;

    private final ContextoClienteFactory contextos;
    private final CopilotoProps props;
    private final ObjectMapper mapper;

    public AgenteNotaPosReuniao(ContextoClienteFactory contextos, CopilotoProps props, ObjectMapper mapper) {
        this.contextos = contextos;
        this.props = props;
        this.mapper = mapper;
    }

    @Action(description = "Monta o contexto do cliente e da transcrição, sem LLM")
    public ContextoNota montarContexto(NotaReuniao nota) {
        return new ContextoNota(contextos.paraCliente(nota.clienteId()), nota.transcricao(), contextos.hoje());
    }

    @Action(description = "Extrai eventos de vida, metas e mudanças de perfil com o LLM")
    public FatosExtraidos extrairFatos(ContextoNota c, OperationContext ctx) {
        return ctx.ai().withLlm(props.modelo())
                .withSystemPrompt(Prompts.NOTA)
                .createObject("Data de referência: " + c.dataReferencia() + "\nContexto do cliente (JSON):\n"
                        + Prompts.contexto(mapper, c.contexto()) + "\nTranscrição:\n" + c.transcricao(), FatosExtraidos.class);
    }

    @AchievesGoal(description = "Fatos da reunião registrados e follow-up planejado")
    @Action(description = "Valida os fatos e cria a ação de follow-up, por regra")
    public ResultadoNota planejarFollowUp(FatosExtraidos fatos, ContextoNota c) {
        String clienteId = c.contexto().clienteId();
        List<EventoVida> eventos = new ArrayList<>();
        int n = 0;
        for (EventoExtraido e : fatos.eventos() == null ? List.<EventoExtraido>of() : fatos.eventos()) {
            eventos.add(new EventoVida("evt-nota-" + clienteId + "-" + (++n), tipo(e.tipo()), e.descricao(),
                    data(e.data(), c.dataReferencia()), OrigemEvento.NOTA_REUNIAO));
        }
        List<AcaoSugerida> acoes = List.of(new AcaoSugerida("acao-" + clienteId + "-nota-followup", clienteId,
                TipoAcao.CONTATO_RELACIONAMENTO, "Enviar resumo da reunião e próximos passos",
                "Registrado na nota da reunião.", null, List.of(), false));
        return new ResultadoNota(fatos.resumo(), eventos, copia(fatos.metas()), copia(fatos.mudancasPerfil()), acoes, GeradoPor.live);
    }

    private static TipoEventoVida tipo(String t) {
        try {
            return TipoEventoVida.valueOf(t == null ? "" : t.strip().toUpperCase());
        } catch (IllegalArgumentException e) {
            return TipoEventoVida.OUTRO;
        }
    }

    private static LocalDate data(String d, LocalDate ref) {
        try {
            return LocalDate.parse(d == null ? "" : d.strip());
        } catch (RuntimeException e) {
            return ref.plusDays(DIAS_EVENTO_SEM_DATA);
        }
    }

    private static List<String> copia(List<String> l) {
        return l == null ? List.of() : List.copyOf(l);
    }
}
