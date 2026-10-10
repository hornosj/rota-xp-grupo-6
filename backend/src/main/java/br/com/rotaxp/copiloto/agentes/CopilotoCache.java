package br.com.rotaxp.copiloto.agentes;

import br.com.rotaxp.copiloto.dominio.Briefing;
import br.com.rotaxp.copiloto.dominio.Enums.Canal;
import br.com.rotaxp.copiloto.dominio.Enums.GeradoPor;
import br.com.rotaxp.copiloto.dominio.MensagemGerada;
import br.com.rotaxp.copiloto.dominio.ResultadoNota;
import org.springframework.stereotype.Component;

/** Modo da demo: lê respostas gravadas; em falta, cai no stub. Nenhuma chamada externa. */
@Component
public class CopilotoCache implements Copiloto {

    private final CacheLlm cache;
    private final ContextoClienteFactory contextos;
    private final ContextoNoticiaFactory contextosNoticia;
    private final CopilotoStub stub;

    public CopilotoCache(CacheLlm cache, ContextoClienteFactory contextos, ContextoNoticiaFactory contextosNoticia, CopilotoStub stub) {
        this.cache = cache;
        this.contextos = contextos;
        this.contextosNoticia = contextosNoticia;
        this.stub = stub;
    }

    static String chaveMotivo(CacheLlm cache, ContextoNoticiaFactory contextosNoticia, String clienteId, String noticiaId) {
        return cache.chave("motivo", contextosNoticia.para(clienteId, noticiaId).cliente(), noticiaId);
    }

    @Override
    public br.com.rotaxp.copiloto.dominio.Radar.MotivoNoticia redigirMotivoNoticia(String clienteId, String noticiaId) {
        return cache.ler(chaveMotivo(cache, contextosNoticia, clienteId, noticiaId), br.com.rotaxp.copiloto.dominio.Radar.MotivoNoticia.class)
                .map(m -> new br.com.rotaxp.copiloto.dominio.Radar.MotivoNoticia(m.texto(), GeradoPor.cache))
                .orElseGet(() -> stub.redigirMotivoNoticia(clienteId, noticiaId));
    }

    static String chaveMensagem(CacheLlm cache, ContextoCliente c, String acaoId, Canal canal) {
        return cache.chave("mensagem", c, acaoId + "-" + canal);
    }

    static String chaveNota(CacheLlm cache, ContextoCliente c, String transcricao) {
        return cache.chave("nota", c, CacheLlm.hashTexto(transcricao));
    }

    @Override
    public MensagemGerada redigirMensagem(String clienteId, String acaoId, Canal canal) {
        ContextoCliente c = contextos.paraAcao(clienteId, acaoId);
        return cache.ler(chaveMensagem(cache, c, acaoId, canal), MensagemGerada.class)
                .map(m -> m.com(GeradoPor.cache))
                .orElseGet(() -> stub.redigirMensagem(clienteId, acaoId, canal));
    }

    @Override
    public Briefing gerarBriefing(String clienteId) {
        ContextoCliente c = contextos.paraCliente(clienteId);
        return cache.ler(cache.chave("briefing", c, null), Briefing.class)
                .map(b -> b.com(GeradoPor.cache))
                .orElseGet(() -> stub.gerarBriefing(clienteId));
    }

    @Override
    public ResultadoNota processarNota(String clienteId, String transcricao) {
        ContextoCliente c = contextos.paraCliente(clienteId);
        return cache.ler(chaveNota(cache, c, transcricao), ResultadoNota.class)
                .map(r -> r.com(GeradoPor.cache))
                .orElseGet(() -> stub.processarNota(clienteId, transcricao));
    }
}
