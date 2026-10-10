package br.com.rotaxp.copiloto.inteligencia.radar;

import java.util.List;

/** Uma origem de notícias (curadoria, RSS...). */
public interface FonteNoticias {
    List<NoticiaColetada> coletar();
}
