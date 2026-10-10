package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.TipoConta;
import java.math.BigDecimal;

public record Conta(String id, String clienteId, String instituicaoId, TipoConta tipo, BigDecimal saldo) {}
