package br.com.rotaxp.copiloto.analise;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.offset;

import br.com.rotaxp.copiloto.analise.InterpretadorTaxa.TaxaEstimada;
import br.com.rotaxp.copiloto.config.DesagioProps;
import br.com.rotaxp.copiloto.config.Premissas;
import br.com.rotaxp.copiloto.dominio.Enums.Indexador;
import br.com.rotaxp.copiloto.dominio.Enums.Produto;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class InterpretadorTaxaTest {

    private final InterpretadorTaxa taxas = new InterpretadorTaxa(
            new Premissas(new BigDecimal("0.10"), new Premissas.Fgc(new BigDecimal("250000"), new BigDecimal("1000000"))),
            new DesagioProps(new BigDecimal("0.045"), new BigDecimal("0.10"), 365, List.of(Produto.CDB)));

    @Test
    void percentualDoCdiUsaOCdiDasPremissas() {
        TaxaEstimada t = taxas.interpretar(Indexador.CDI, "112% do CDI").orElseThrow();
        assertThat(t.anual()).isCloseTo(0.112, offset(1e-9));
        assertThat(t.dependeDePremissa()).isTrue();
    }

    @Test
    void ipcaMaisSpreadCompoeMultiplicativamente() {
        TaxaEstimada t = taxas.interpretar(Indexador.IPCA, "IPCA + 6,20% a.a.").orElseThrow();
        assertThat(t.anual()).isCloseTo(1.045 * 1.062 - 1, offset(1e-9));
        assertThat(t.premissa()).contains("IPCA");
    }

    @Test
    void selicMaisSpreadSoma() {
        assertThat(taxas.interpretar(Indexador.SELIC, "SELIC + 0,06% a.a.").orElseThrow().anual())
                .isCloseTo(0.1006, offset(1e-9));
    }

    @Test
    void prefixadaNaoDependeDePremissa() {
        TaxaEstimada t = taxas.interpretar(Indexador.PRE, "13,10% a.a.").orElseThrow();
        assertThat(t.anual()).isCloseTo(0.131, offset(1e-9));
        assertThat(t.dependeDePremissa()).isFalse();
    }

    @Test
    void semTaxaInterpretavel() {
        assertThat(taxas.interpretar(Indexador.NA, "Regra da poupança")).isEmpty();
        assertThat(taxas.interpretar(Indexador.CDI, null)).isEmpty();
        assertThat(taxas.interpretar(Indexador.CDI, "taxa negociada")).isEmpty();
        assertThat(taxas.interpretar(Indexador.IPCA, "112% do CDI")).isEmpty();
    }
}