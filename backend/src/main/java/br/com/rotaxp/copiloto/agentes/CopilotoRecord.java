package br.com.rotaxp.copiloto.agentes;

import br.com.rotaxp.copiloto.dominio.Briefing;
import br.com.rotaxp.copiloto.dominio.Enums.Canal;
import br.com.rotaxp.copiloto.dominio.Enums.GeradoPor;
import br.com.rotaxp.copiloto.dominio.MensagemGerada;
import br.com.rotaxp.copiloto.dominio.ResultadoNota;
import org.springframework.stereotype.Component;

/** Live + grava em llm-cache/ (só respostas que vieram de fato do LLM). */
@Component
public class CopilotoRecord implements Copiloto {

    private final CopilotoLive live;
    private final CacheLlm cache;
    private final ContextoClienteFactory contextos;
    private final ContextoNoticiaFactory contextosNoticia;

    public CopilotoRecord(CopilotoLive live, CacheLlm cache, ContextoClienteFactory contextos, ContextoNoticiaFactory contextosNoticia) {
        this.live = live;
        this.cache = cache;
        this.contextos = contextos;
        this.contextosNoticia = contextosNoticia;
    }

    @Override
    public br.com.rotaxp.copiloto.dominio.Radar.MotivoNoticia redigirMotivoNoticia(String clienteId, String noticiaId) {
        var m = live.redigirMotivoNoticia(clienteId, noticiaId);
        if (m.geradoPor() == GeradoPor.live) cache.gravar(CopilotoCache.chaveMotivo(cache, contextosNoticia, clienteId, noticiaId), m);
        return m;
    }

    @Override
    public MensagemGerada redigirMensagem(String clienteId, String acaoId, Canal canal) {
        MensagemGerada m = live.redigirMensagem(clienteId, acaoId, canal);
        if (m.geradoPor() == GeradoPor.live) {
            cache.gravar(CopilotoCache.chaveMensagem(cache, contextos.paraAcao(clienteId, acaoId), acaoId, canal), m);
        }
        return m;
    }

    @Override
    public Briefing gerarBriefing(String clienteId) {
        Briefing b = live.gerarBriefing(clienteId);
        if (b.geradoPor() == GeradoPor.live) cache.gravar(cache.chave("briefing", contextos.paraCliente(clienteId), null), b);
        return b;
    }

    @Override
    public ResultadoNota processarNota(String clienteId, String transcricao) {
        ResultadoNota r = live.processarNota(clienteId, transcricao);
        if (r.geradoPor() == GeradoPor.live) {
            cache.gravar(CopilotoCache.chaveNota(cache, contextos.paraCliente(clienteId), transcricao), r);
        }
        return r;
    }
}
