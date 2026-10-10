package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.TipoCredito;
import java.math.BigDecimal;

public record OperacaoCredito(
        String id, String clienteId, String instituicaoId, TipoCredito tipo,
        BigDecimal saldoDevedor, BigDecimal parcelaMensal, BigDecimal taxaAnual) {}
