package br.com.rotaxp.copiloto.dominio;

import java.math.BigDecimal;
import java.util.List;

public record Patrimonio(
        BigDecimal totalVisivel, BigDecimal naXp, BigDecimal foraXp, double shareOfWalletXp,
        List<PorInstituicao> porInstituicao, List<PorProduto> porProduto) {

    public record PorInstituicao(String instituicaoId, String nome, boolean ehXp,
                                 BigDecimal investimentos, BigDecimal saldoContas, BigDecimal total) {}

    /** produto: um Produto ou SALDO_CONTA. */
    public record PorProduto(String produto, BigDecimal total) {}
}
