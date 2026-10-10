package br.com.rotaxp.copiloto.agentes;

import br.com.rotaxp.copiloto.agentes.AgentesTipos.NotaReuniao;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.PedidoBriefing;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.PedidoMensagem;
import br.com.rotaxp.copiloto.dominio.Briefing;
import br.com.rotaxp.copiloto.dominio.Enums.Canal;
import br.com.rotaxp.copiloto.dominio.MensagemGerada;
import br.com.rotaxp.copiloto.dominio.ResultadoNota;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Modo live: os agentes Embabel (AgenteMensagemCliente, AgenteBriefing, AgenteNotaPosReuniao) redigem a
 * partir do ContextoCliente já calculado. Qualquer falha ou resposta incompleta cai no stub — a demo
 * nunca quebra por causa da IA.
 */
@Component
public class CopilotoLive implements Copiloto {

    private static final Logger log = LoggerFactory.getLogger(CopilotoLive.class);

    private final ExecutorAgentes agentes;
    private final CopilotoStub stub;

    public CopilotoLive(ExecutorAgentes agentes, CopilotoStub stub) {
        this.agentes = agentes;
        this.stub = stub;
    }

    @Override
    public MensagemGerada redigirMensagem(String clienteId, String acaoId, Canal canal) {
        return comFallback("mensagem " + clienteId + "/" + acaoId,
                () -> valida(agentes.executar(new PedidoMensagem(clienteId, acaoId, canal), MensagemGerada.class),
                        m -> m.texto() != null && !m.texto().isBlank()),
                () -> stub.redigirMensagem(clienteId, acaoId, canal));
    }

    @Override
    public Briefing gerarBriefing(String clienteId) {
        return comFallback("briefing " + clienteId,
                () -> valida(agentes.executar(new PedidoBriefing(clienteId), Briefing.class),
                        b -> !b.bullets().isEmpty() && !b.perguntasSugeridas().isEmpty()),
                () -> stub.gerarBriefing(clienteId));
    }

    @Override
    public ResultadoNota processarNota(String clienteId, String transcricao) {
        return comFallback("nota " + clienteId,
                () -> valida(agentes.executar(new NotaReuniao(clienteId, transcricao), ResultadoNota.class), r -> r.resumo() != null),
                () -> stub.processarNota(clienteId, transcricao));
    }

    private static <T> T valida(T valor, java.util.function.Predicate<T> ok) {
        if (valor == null || !ok.test(valor)) throw new IllegalStateException("resposta incompleta do agente");
        return valor;
    }

    private static <T> T comFallback(String oQue, Supplier<T> live, Supplier<T> fallback) {
        try {
            return live.get();
        } catch (Exception e) {   // não só RuntimeException: o invoke() do Embabel (Kotlin) propaga ExecutionException
            log.warn("Agente falhou ({}): {} — usando stub", oQue, e.getMessage());
            return fallback.get();
        }
    }
}
