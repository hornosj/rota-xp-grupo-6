package br.com.rotaxp.copiloto.agentes;

import br.com.rotaxp.copiloto.agentes.AgentesTipos.ContextoNoticia;
import br.com.rotaxp.copiloto.dominio.Excecoes.NaoEncontrado;
import br.com.rotaxp.copiloto.dominio.Radar.ImpactoNoticia;
import br.com.rotaxp.copiloto.dominio.Radar.NoticiaClassificada;
import br.com.rotaxp.copiloto.inteligencia.radar.RadarService;
import org.springframework.stereotype.Component;

/** Contexto do motivo de contato: só existe se a notícia de fato mexe na carteira visível do cliente. */
@Component
public class ContextoNoticiaFactory {

    private final ContextoClienteFactory contextos;
    private final RadarService radar;

    public ContextoNoticiaFactory(ContextoClienteFactory contextos, RadarService radar) {
        this.contextos = contextos;
        this.radar = radar;
    }

    public ContextoNoticia para(String clienteId, String noticiaId) {
        ImpactoNoticia impacto = radar.impactosDoCliente(clienteId).stream()
                .filter(i -> i.noticiaId().equals(noticiaId)).findFirst()
                .orElseThrow(() -> new NaoEncontrado("A notícia " + noticiaId + " não mexe na carteira de " + clienteId));
        NoticiaClassificada n = radar.noticia(noticiaId);
        return new ContextoNoticia(contextos.paraCliente(clienteId), noticiaId, n.noticia().titulo(), n.noticia().resumo(),
                n.noticia().fonte(), n.classificacao().direcao().name(), n.classificacao().resumoImpacto(), impacto);
    }
}
