package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.TipoNecessidade;

/**
 * Produto do catálogo (application.yml: anotacoes.catalogo) para uma necessidade; o motivo vem da nota.
 *
 * @param revisao  o cliente já tem o produto: a sugestão é revisá-lo (ex.: acionar o sinistro)
 * @param sensivel momento delicado (luto, doença, perda): acolher antes de ofertar
 */
public record RecomendacaoProduto(TipoNecessidade necessidade, String produto, String descricao, String motivo,
                                  boolean revisao, boolean sensivel) {}
