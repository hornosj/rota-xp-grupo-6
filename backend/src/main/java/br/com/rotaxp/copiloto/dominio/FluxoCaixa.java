package br.com.rotaxp.copiloto.dominio;

import java.math.BigDecimal;
import java.util.List;

public record FluxoCaixa(
        BigDecimal rendaMensal, List<FonteRenda> fontesRenda,
        BigDecimal custoVidaMensal, BigDecimal capacidadeAporteMensal,
        BigDecimal liquidezImediata, double reservaEmergenciaMeses,
        boolean parcial, String observacao) {

    public record FonteRenda(String pagadorNome, String instituicaoId, BigDecimal valorMensal, int diaDoMes) {}
}
