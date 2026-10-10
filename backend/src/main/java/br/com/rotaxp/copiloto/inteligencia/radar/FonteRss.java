package br.com.rotaxp.copiloto.inteligencia.radar;

import br.com.rotaxp.copiloto.config.RssProps;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Feeds RSS reais (ex.: InfoMoney, CNN Brasil, Bloomberg Línea). Só título, resumo e link — o texto
 * completo fica no site de origem. Um feed fora do ar não derruba os outros.
 */
public class FonteRss implements FonteNoticias {

    private static final Logger log = LoggerFactory.getLogger(FonteRss.class);

    /** Busca o conteúdo de uma URL (HTTP na aplicação; falso nos testes). */
    public interface Buscador {
        String buscar(String url) throws IOException, InterruptedException;
    }

    private final RssProps props;
    private final Buscador buscador;

    public FonteRss(RssProps props, Buscador buscador) {
        this.props = props;
        this.buscador = buscador;
    }

    @Override
    public List<NoticiaColetada> coletar() {
        List<NoticiaColetada> r = new ArrayList<>();
        for (RssProps.Feed feed : props.feeds() == null ? List.<RssProps.Feed>of() : props.feeds()) {
            try {
                r.addAll(LeitorRss.ler(buscador.buscar(feed.url()), feed.nome(), props.maxItensPorFeed()));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return r;
            } catch (Exception e) {
                log.warn("Feed {} ({}) falhou: {}", feed.nome(), feed.url(), e.getMessage());
            }
        }
        return r;
    }
}
