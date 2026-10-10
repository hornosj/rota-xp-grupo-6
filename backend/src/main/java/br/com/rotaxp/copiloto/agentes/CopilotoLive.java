package br.com.rotaxp.copiloto.agentes;

import br.com.rotaxp.copiloto.dominio.AcaoSugerida;
import br.com.rotaxp.copiloto.dominio.Briefing;
import br.com.rotaxp.copiloto.dominio.Enums.Canal;
import br.com.rotaxp.copiloto.dominio.Enums.GeradoPor;
import br.com.rotaxp.copiloto.dominio.Enums.OrigemEvento;
import br.com.rotaxp.copiloto.dominio.Enums.TipoEventoVida;
import br.com.rotaxp.copiloto.dominio.EventoVida;
import br.com.rotaxp.copiloto.dominio.MensagemGerada;
import br.com.rotaxp.copiloto.dominio.ResultadoNota;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Modo live: o LLM só recebe o ContextoCliente (já calculado) e redige. Qualquer falha do LLM ou
 * resposta fora do formato cai no stub — a demo nunca quebra por causa da IA.
 */
@Component
public class CopilotoLive implements Copiloto {

    private static final Logger log = LoggerFactory.getLogger(CopilotoLive.class);

    private final ContextoClienteFactory contextos;
    private final LlmCliente llm;
    private final ObjectMapper mapper;
    private final CopilotoStub stub;

    public CopilotoLive(ContextoClienteFactory contextos, LlmCliente llm, ObjectMapper mapper, CopilotoStub stub) {
        this.contextos = contextos;
        this.llm = llm;
        this.mapper = mapper;
        this.stub = stub;
    }

    @Override
    public MensagemGerada redigirMensagem(String clienteId, String acaoId, Canal canal) {
        ContextoCliente c = contextos.paraAcao(clienteId, acaoId);
        try {
            String texto = llm.completar(Prompts.MENSAGEM,
                    "Canal: " + canal + "\nContexto do cliente (JSON):\n" + json(c)
                            + "\nEscreva a mensagem do assessor para o cliente sobre a ação sugerida.").trim();
            if (texto.isEmpty()) throw new IllegalStateException("resposta vazia");
            return new MensagemGerada(texto, canal, GeradoPor.live);
        } catch (RuntimeException e) {
            log.warn("LLM falhou na mensagem de {} / {}: {} — usando stub", clienteId, acaoId, e.getMessage());
            return stub.redigirMensagem(clienteId, acaoId, canal);
        }
    }

    @Override
    public Briefing gerarBriefing(String clienteId) {
        ContextoCliente c = contextos.paraCliente(clienteId);
        try {
            JsonNode r = lerJson(llm.completar(Prompts.BRIEFING, "Contexto do cliente (JSON):\n" + json(c)));
            List<String> bullets = textos(r.path("bullets"));
            List<String> perguntas = textos(r.path("perguntasSugeridas"));
            if (bullets.isEmpty() || perguntas.isEmpty()) throw new IllegalStateException("briefing incompleto");
            return new Briefing(clienteId, bullets, perguntas, GeradoPor.live);
        } catch (RuntimeException e) {
            log.warn("LLM falhou no briefing de {}: {} — usando stub", clienteId, e.getMessage());
            return stub.gerarBriefing(clienteId);
        }
    }

    @Override
    public ResultadoNota processarNota(String clienteId, String transcricao) {
        ContextoCliente c = contextos.paraCliente(clienteId);
        LocalDate ref = contextos.hoje();
        try {
            JsonNode r = lerJson(llm.completar(Prompts.NOTA, "Data de referência: " + ref + "\nContexto do cliente (JSON):\n"
                    + json(c) + "\nTranscrição:\n" + transcricao));
            List<EventoVida> eventos = new ArrayList<>();
            int n = 0;
            for (JsonNode e : r.path("eventos")) {
                TipoEventoVida tipo;
                try { tipo = TipoEventoVida.valueOf(e.path("tipo").asText()); } catch (IllegalArgumentException x) { tipo = TipoEventoVida.OUTRO; }
                LocalDate data;
                try { data = LocalDate.parse(e.path("data").asText()); } catch (RuntimeException x) { data = ref.plusDays(180); }
                eventos.add(new EventoVida("evt-nota-" + clienteId + "-" + (++n), tipo, e.path("descricao").asText(), data,
                        OrigemEvento.NOTA_REUNIAO));
            }
            List<AcaoSugerida> acoes = List.of(new AcaoSugerida("acao-" + clienteId + "-nota-followup", clienteId,
                    br.com.rotaxp.copiloto.dominio.Enums.TipoAcao.CONTATO_RELACIONAMENTO,
                    "Enviar resumo da reunião e próximos passos", "Registrado na nota da reunião.", null, List.of(), false));
            return new ResultadoNota(r.path("resumo").asText(), eventos, textos(r.path("metas")),
                    textos(r.path("mudancasPerfil")), acoes, GeradoPor.live);
        } catch (RuntimeException e) {
            log.warn("LLM falhou na nota de {}: {} — usando stub", clienteId, e.getMessage());
            return stub.processarNota(clienteId, transcricao);
        }
    }

    private String json(ContextoCliente c) {
        try {
            return mapper.writerWithDefaultPrettyPrinter().writeValueAsString(c);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private JsonNode lerJson(String resposta) {
        String s = resposta.trim().replaceFirst("^```(json)?\\s*", "").replaceFirst("\\s*```$", "");
        try {
            return mapper.readTree(s);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("resposta não é JSON", e);
        }
    }

    private static List<String> textos(JsonNode arr) {
        List<String> r = new ArrayList<>();
        arr.forEach(n -> r.add(n.asText()));
        return r;
    }
}
