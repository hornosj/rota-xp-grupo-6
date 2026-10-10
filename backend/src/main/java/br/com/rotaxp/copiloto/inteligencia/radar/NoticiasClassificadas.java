package br.com.rotaxp.copiloto.inteligencia.radar;

import java.util.List;

/** Publicado quando um processamento do radar classifica notícias novas. */
public record NoticiasClassificadas(List<String> noticiaIds) {}
