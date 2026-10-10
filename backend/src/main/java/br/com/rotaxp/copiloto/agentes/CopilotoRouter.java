package br.com.rotaxp.copiloto.agentes;

import br.com.rotaxp.copiloto.config.CopilotoProps;
import br.com.rotaxp.copiloto.dominio.Briefing;
import br.com.rotaxp.copiloto.dominio.Enums.Canal;
import br.com.rotaxp.copiloto.dominio.MensagemGerada;
import br.com.rotaxp.copiloto.dominio.ResultadoNota;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

/** Escolhe a implementação por copiloto.modo. live/record sem chave de API viram stub. */
@Primary
@Component
public class CopilotoRouter implements Copiloto {

    private static final Logger log = LoggerFactory.getLogger(CopilotoRouter.class);

    private final Copiloto alvo;
    private final String modoEfetivo;

    public CopilotoRouter(CopilotoProps props, CopilotoStub stub, CopilotoCache cache, CopilotoLive live, CopilotoRecord record) {
        String modo = props.modo() == null ? "stub" : props.modo().toLowerCase(Locale.ROOT);
        if ((modo.equals("live") || modo.equals("record")) && !props.temChave()) {
            log.warn("copiloto.modo={} sem ANTHROPIC_API_KEY: usando stub", modo);
            modo = "stub";
        }
        this.modoEfetivo = modo;
        this.alvo = switch (modo) {
            case "cache" -> cache;
            case "live" -> live;
            case "record" -> record;
            default -> stub;
        };
    }

    public String modoEfetivo() { return modoEfetivo; }

    @Override
    public MensagemGerada redigirMensagem(String clienteId, String acaoId, Canal canal) {
        return alvo.redigirMensagem(clienteId, acaoId, canal);
    }

    @Override
    public Briefing gerarBriefing(String clienteId) {
        return alvo.gerarBriefing(clienteId);
    }

    @Override
    public ResultadoNota processarNota(String clienteId, String transcricao) {
        return alvo.processarNota(clienteId, transcricao);
    }

    @Override
    public br.com.rotaxp.copiloto.dominio.Radar.MotivoNoticia redigirMotivoNoticia(String clienteId, String noticiaId) {
        return alvo.redigirMotivoNoticia(clienteId, noticiaId);
    }
}
