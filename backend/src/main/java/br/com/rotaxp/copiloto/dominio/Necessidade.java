package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.TipoNecessidade;

/**
 * Necessidade do cliente revelada numa nota do assessor ("bateu o carro" → PROTECAO_VEICULO).
 * {@code jaPossui}: a nota diz que o cliente já tem a proteção ("o carro tá com seguro") — vira revisão, não venda.
 */
public record Necessidade(TipoNecessidade tipo, String motivo, boolean jaPossui) {}
