package br.com.rotaxp.copiloto.analise;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.rotaxp.copiloto.config.RentabilidadeProps;
import br.com.rotaxp.copiloto.dominio.Excecoes.RequisicaoInvalida;
import br.com.rotaxp.copiloto.dominio.SimulacaoRentabilidade.PeriodoRentabilidade;
import br.com.rotaxp.copiloto.dominio.SimulacaoRentabilidade.RentabilidadePedido;
import br.com.rotaxp.copiloto.dominio.SimulacaoRentabilidade.RentabilidadeResultado;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class RentabilidadeServiceTest {

    private final RentabilidadeService service = new RentabilidadeService(new RentabilidadeProps(12));

    private static BigDecimal bd(String s) { return s == null ? null : new BigDecimal(s); }

    private static PeriodoRentabilidade p(String retorno, String aporte) {
        return new PeriodoRentabilidade(bd(retorno), bd(aporte));
    }

    private static RentabilidadePedido pedido(String inicial, PeriodoRentabilidade... periodos) {
        return new RentabilidadePedido(bd(inicial), List.of(periodos));
    }

    @Test
    void exemploDoPlan() {
        RentabilidadeResultado r = service.simular(pedido("50000", p("0.20", "25000"), p("-0.08", null)));
        assertThat(r.totalAportado()).isEqualByComparingTo("75000.00");
        assertThat(r.valorFinal()).isEqualByComparingTo("78200.00");
        assertThat(r.ganho()).isEqualByComparingTo("3200.00");
        assertThat(r.ganhoPercentual()).isEqualTo(0.042667);
        assertThat(r.twr()).isEqualTo(0.104);
        assertThat(r.explicacao()).contains("10,4%").contains("não garante");
        assertThat(r.premissas()).isNotEmpty();
    }

    @Test
    void serieMostraCadaPeriodoComTwrAcumulado() {
        RentabilidadeResultado r = service.simular(pedido("50000", p("0.20", "25000"), p("-0.08", null)));
        assertThat(r.periodos()).hasSize(2);

        var primeiro = r.periodos().get(0);
        assertThat(primeiro.periodo()).isEqualTo(1);
        assertThat(primeiro.valorInicial()).isEqualByComparingTo("50000.00");
        assertThat(primeiro.valorAntesDoAporte()).isEqualByComparingTo("60000.00");
        assertThat(primeiro.aporte()).isEqualByComparingTo("25000.00");
        assertThat(primeiro.valorFinal()).isEqualByComparingTo("85000.00");
        assertThat(primeiro.twrAcumulado()).isEqualTo(0.2);

        var segundo = r.periodos().get(1);
        assertThat(segundo.valorInicial()).isEqualByComparingTo("85000.00");
        assertThat(segundo.aporte()).isEqualByComparingTo("0.00");
        assertThat(segundo.valorFinal()).isEqualByComparingTo("78200.00");
        assertThat(segundo.twrAcumulado()).isEqualTo(0.104);
    }

    @Test
    void semAportesGanhoESimplesETwrCoincidem() {
        RentabilidadeResultado r = service.simular(pedido("100000", p("0.10", null), p("0.10", null)));
        assertThat(r.totalAportado()).isEqualByComparingTo("100000.00");
        assertThat(r.valorFinal()).isEqualByComparingTo("121000.00");
        assertThat(r.ganho()).isEqualByComparingTo("21000.00");
        assertThat(r.ganhoPercentual()).isEqualTo(0.21);
        assertThat(r.twr()).isEqualTo(0.21);
    }

    @Test
    void twrNaoDependeDoTamanhoDoAporte() {
        RentabilidadeResultado pequeno = service.simular(pedido("50000", p("0.20", "1000"), p("-0.08", null)));
        RentabilidadeResultado grande = service.simular(pedido("50000", p("0.20", "500000"), p("-0.08", null)));
        assertThat(pequeno.twr()).isEqualTo(grande.twr());
        assertThat(grande.ganho()).isNotEqualByComparingTo(pequeno.ganho());
    }

    @Test
    void perdaSaiComoGanhoNegativoEExplicacaoDizPerda() {
        RentabilidadeResultado r = service.simular(pedido("100000", p("-0.10", null)));
        assertThat(r.valorFinal()).isEqualByComparingTo("90000.00");
        assertThat(r.ganho()).isEqualByComparingTo("-10000.00");
        assertThat(r.ganhoPercentual()).isEqualTo(-0.1);
        assertThat(r.twr()).isEqualTo(-0.1);
        assertThat(r.explicacao()).contains("perda");
    }

    @Test
    void aporteDoUltimoPeriodoEntraNoTotalSemAfetarOTwr() {
        RentabilidadeResultado r = service.simular(pedido("10000", p("0.05", "5000")));
        assertThat(r.totalAportado()).isEqualByComparingTo("15000.00");
        assertThat(r.valorFinal()).isEqualByComparingTo("15500.00");
        assertThat(r.ganho()).isEqualByComparingTo("500.00");
        assertThat(r.twr()).isEqualTo(0.05);
    }

    @Test
    void validaOPedido() {
        assertThatThrownBy(() -> service.simular(null)).isInstanceOf(RequisicaoInvalida.class);
        assertThatThrownBy(() -> service.simular(new RentabilidadePedido(null, null)))
                .isInstanceOf(RequisicaoInvalida.class)
                .hasMessageContaining("valorInicial").hasMessageContaining("periodos");
        assertThatThrownBy(() -> service.simular(pedido("0", p("0.1", null))))
                .hasMessageContaining("valorInicial deve ser maior que zero");
        assertThatThrownBy(() -> service.simular(pedido("1000")))
                .hasMessageContaining("periodos");
        assertThatThrownBy(() -> service.simular(pedido("1000", p("-1", null))))
                .hasMessageContaining("retorno do período 1");
        assertThatThrownBy(() -> service.simular(pedido("1000", p("0.1", null), p(null, null))))
                .hasMessageContaining("retorno do período 2");
        assertThatThrownBy(() -> service.simular(pedido("1000", p("0.1", "-5"))))
                .hasMessageContaining("aporte do período 1");
    }

    @Test
    void limitaONumeroDePeriodos() {
        List<PeriodoRentabilidade> muitos = new ArrayList<>();
        for (int i = 0; i < 13; i++) muitos.add(p("0.01", null));
        assertThatThrownBy(() -> service.simular(new RentabilidadePedido(bd("1000"), muitos)))
                .isInstanceOf(RequisicaoInvalida.class).hasMessageContaining("12");
    }
}
