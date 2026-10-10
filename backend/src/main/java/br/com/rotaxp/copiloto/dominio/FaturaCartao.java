package br.com.rotaxp.copiloto.dominio;

import java.math.BigDecimal;

public record FaturaCartao(String id, String clienteId, String instituicaoId, String mesReferencia, BigDecimal valorTotal) {}
