package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.TipoNecessidade;

/** Necessidade do cliente revelada numa nota do assessor ("bateu o carro" → PROTECAO_VEICULO). */
public record Necessidade(TipoNecessidade tipo, String motivo) {}
