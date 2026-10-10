package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.TipoNecessidade;

/** Produto do catálogo (application.yml: anotacoes.catalogo) para uma necessidade; o motivo vem da nota. */
public record RecomendacaoProduto(TipoNecessidade necessidade, String produto, String descricao, String motivo) {}
