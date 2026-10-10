package br.com.rotaxp.copiloto.dominio;

import java.math.BigDecimal;
import java.util.List;

public final class SimulacaoRentabilidade {
    private SimulacaoRentabilidade() {}

    public record PeriodoRentabilidade(BigDecimal retorno, BigDecimal aporte) {}

    public record RentabilidadePedido(BigDecimal valorInicial, List<PeriodoRentabilidade> periodos) {}

    public record PontoRentabilidade(
            int periodo, BigDecimal valorInicial, double retorno, BigDecimal valorAntesDoAporte,
            BigDecimal aporte, BigDecimal valorFinal, double twrAcumulado) {}

    public record RentabilidadeResultado(
            BigDecimal valorInicial,
            BigDecimal totalAportado,
            BigDecimal valorFinal,
            BigDecimal ganho,
            double ganhoPercentual,
            double twr,
            List<PontoRentabilidade> periodos,
            String explicacao,
            List<String> premissas) {}
}
