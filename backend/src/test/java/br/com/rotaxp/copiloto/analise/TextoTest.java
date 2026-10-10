package br.com.rotaxp.copiloto.analise;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class TextoTest {

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "400000  | R$ 400 mil",
            "61000   | R$ 61 mil",
            "13600   | R$ 13,6 mil",
            "1200000 | R$ 1,2 milhão",
            "2500000 | R$ 2,5 milhões",
            "850     | R$ 850",
            "0       | R$ 0",
    })
    void reaisCurtos(String valor, String esperado) {
        assertThat(Texto.reais(new BigDecimal(valor))).isEqualTo(esperado);
    }

    @Test
    void reaisCompletos() {
        assertThat(Texto.reaisCompletos(new BigDecimal("61000"))).isEqualTo("R$ 61.000,00");
    }

    @Test
    void percentual() {
        assertThat(Texto.pct(0.2446)).isEqualTo("24,5%");
        assertThat(Texto.pct(1.0)).isEqualTo("100%");
    }

    @Test
    void numeroComUmaCasa() {
        assertThat(Texto.decimal(6.5)).isEqualTo("6,5");
        assertThat(Texto.decimal(3.0)).isEqualTo("3");
    }
}
