package br.com.rotaxp.copiloto.analise;

import br.com.rotaxp.copiloto.dominio.FluxoCaixa;
import java.math.BigDecimal;
import java.util.Map;

/** Resultado do fluxo de caixa, com os números auxiliares que outras regras usam. */
public record AnaliseFluxo(FluxoCaixa fluxo, BigDecimal saldoContas, Map<String, BigDecimal> custoPorCategoria) {}
