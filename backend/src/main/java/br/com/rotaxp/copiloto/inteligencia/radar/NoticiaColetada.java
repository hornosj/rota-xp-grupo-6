package br.com.rotaxp.copiloto.inteligencia.radar;

import br.com.rotaxp.copiloto.dominio.Radar.Classificacao;
import br.com.rotaxp.copiloto.dominio.Radar.Noticia;

/** Notícia vinda de uma fonte, com a classificação de referência quando a fonte é curada (senão null). */
public record NoticiaColetada(Noticia noticia, Classificacao referencia) {}
