package br.com.rotaxp.copiloto.analise;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import br.com.rotaxp.copiloto.dominio.SimulacaoDesagio.DesagioDetalhado;
import br.com.rotaxp.copiloto.dominio.SimulacaoDesagio.EntradaResolvida;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class DesagioServiceTest {

    private final DesagioService service = new DesagioService();

    private static EntradaResolvida porDesagio(String valor, double antiga, double nova, double prazo, String d) {
        return new EntradaResolvida(null, null, new BigDecimal(valor), antiga, nova, prazo, new BigDecimal(d), null);
    }

    @Test
    void exemploDoPlan() {
        DesagioDetalhado r = service.calcular(porDesagio("100000", 0.12, 0.14, 3, "0.03"), List.of());
        assertThat(r.breakEvenAnos()).isEqualTo(1.72);
        assertThat(r.breakEvenMeses()).isEqualTo(21);
        assertThat(r.compensa()).isTrue();
        assertThat(r.perdaImediata()).isEqualByComparingTo("3000.00");
        assertThat(r.valorFinalManter()).isEqualByComparingTo("140492.80");
        assertThat(r.valorFinalVender()).isEqualByComparingTo("143709.77");
        assertThat(r.ganhoDaTroca()).isEqualByComparingTo("3216.97");
        assertThat(r.spreadTaxas()).isEqualTo(0.02);
        assertThat(r.explicacao()).contains("IR");
        assertThat(r.premissas()).isNotEmpty();
    }

    @Test
    void desagioMaximoEEmpate() {
        DesagioDetalhado base = service.calcular(porDesagio("100000", 0.12, 0.14, 3, "0.03"), List.of());
        assertThat(base.desagioMaximoQueCompensa()).isEqualTo(0.051714);
        assertThat(base.precoMinimoQueCompensa()).isEqualByComparingTo("94828.64");

        DesagioDetalhado noLimite = service.calcular(
                porDesagio("100000", 0.12, 0.14, 3, BigDecimal.valueOf(base.desagioMaximoQueCompensa()).toPlainString()), List.of());
        assertThat(noLimite.ganhoDaTroca().abs().doubleValue()).isLessThan(1.0);

        DesagioDetalhado acima = service.calcular(porDesagio("100000", 0.12, 0.14, 3, "0.06"), List.of());
        assertThat(acima.compensa()).isFalse();
        assertThat(acima.ganhoDaTroca().signum()).isNegative();
        assertThat(acima.breakEvenAnos()).isGreaterThan(3.0);
    }

    @Test
    void precoDeVendaEquivaleAoDesagio() {
        DesagioDetalhado r = service.calcular(
                new EntradaResolvida(null, null, new BigDecimal("100000"), 0.12, 0.14, 3, null, new BigDecimal("97000")), List.of());
        assertThat(r.entrada().desagio()).isEqualTo(0.03);
        assertThat(r.breakEvenAnos()).isEqualTo(1.72);
        assertThat(r.perdaImediata()).isEqualByComparingTo("3000.00");
    }

    @Test
    void taxaNovaNaoSuperaAAntigaNuncaCompensa() {
        DesagioDetalhado r = service.calcular(porDesagio("100000", 0.12, 0.10, 3, "0.02"), List.of());
        assertThat(r.compensa()).isFalse();
        assertThat(r.breakEvenAnos()).isNull();
        assertThat(r.breakEvenMeses()).isNull();
        assertThat(r.desagioMaximoQueCompensa()).isNull();
        assertThat(r.precoMinimoQueCompensa()).isNull();
        assertThat(r.ganhoDaTroca().signum()).isNegative();
    }

    @Test
    void semDesagioETaxaMaiorCompensaDeImediato() {
        DesagioDetalhado r = service.calcular(porDesagio("100000", 0.12, 0.14, 0.5, "0"), List.of());
        assertThat(r.compensa()).isTrue();
        assertThat(r.breakEvenAnos()).isZero();
        assertThat(r.perdaImediata()).isEqualByComparingTo("0.00");
    }

    @Test
    void serieMensalComecaNaPerdaETerminaNoPrazo() {
        DesagioDetalhado r = service.calcular(porDesagio("100000", 0.12, 0.14, 3, "0.03"), List.of());
        assertThat(r.serie()).hasSize(37);
        assertThat(r.serie().get(0).diferenca()).isEqualByComparingTo("-3000.00");
        assertThat(r.serie().get(36).anos()).isEqualTo(3.0);
        assertThat(r.serie().get(36).valorVender()).isEqualByComparingTo(r.valorFinalVender());
        assertThat(r.serie().get(36).valorManter()).isEqualByComparingTo(r.valorFinalManter());
    }

    @Test
    void prazoQuebradoGanhaPontoFinalExato() {
        DesagioDetalhado r = service.calcular(porDesagio("100000", 0.12, 0.14, 1.68, "0.03"), List.of());
        var ultimo = r.serie().get(r.serie().size() - 1);
        assertThat(ultimo.anos()).isEqualTo(1.68);
        assertThat(r.serie().get(r.serie().size() - 2).anos()).isCloseTo(1.6667, within(0.0001));
    }

    @Test
    void breakEvenIgualAoPrazoQuandoODesagioEOJusto() {
        double dJusto = 1 - Math.pow(1.12 / 1.14, 2);
        DesagioDetalhado r = service.calcular(porDesagio("100000", 0.12, 0.14, 2, BigDecimal.valueOf(dJusto).toPlainString()), List.of());
        assertThat(r.breakEvenAnos()).isEqualTo(2.0);
    }
}