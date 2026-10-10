package br.com.rotaxp.copiloto.consolidacao;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotaxp.copiloto.dominio.Cobertura;
import br.com.rotaxp.copiloto.dominio.Enums.ProdutoDeclarado;
import br.com.rotaxp.copiloto.dominio.Patrimonio;
import br.com.rotaxp.copiloto.dominio.Patrimonio.PorInstituicao;
import br.com.rotaxp.copiloto.dominio.Patrimonio.PorProduto;
import br.com.rotaxp.copiloto.support.CenarioBuilder;
import br.com.rotaxp.copiloto.support.Cenarios;
import br.com.rotaxp.copiloto.support.Infra;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ConsolidacaoTest {

    private final PatrimonioService patrimonio = new PatrimonioService();
    private final CoberturaService cobertura = new CoberturaService();
    private Infra i;

    @BeforeEach
    void setUp() {
        i = new Infra(Cenarios.marina(CenarioBuilder.comInstituicoesPadrao()).build());
    }

    @Test
    void patrimonioDaMarinaAntes() {
        Patrimonio p = patrimonio.calcular(i.gateway.dados("cli-001"));

        assertThat(p.totalVisivel()).isEqualByComparingTo("985000");
        assertThat(p.naXp()).isEqualByComparingTo("900000");
        assertThat(p.foraXp()).isEqualByComparingTo("85000");
        assertThat(p.shareOfWalletXp()).isEqualTo(0.9137);
        assertThat(p.porInstituicao()).extracting(PorInstituicao::instituicaoId).containsExactly("inst-xp", "inst-aurora");
        PorInstituicao aurora = p.porInstituicao().get(1);
        assertThat(aurora.saldoContas()).isEqualByComparingTo("85000");
        assertThat(aurora.investimentos()).isEqualByComparingTo("0");
        assertThat(aurora.total()).isEqualByComparingTo("85000");
        assertThat(p.porProduto()).extracting(PorProduto::produto)
                .containsExactly("TESOURO", "FUNDO", "CDB", "ACAO", "SALDO_CONTA");
    }

    @Test
    void patrimonioDaMarinaDepoisIncluiHorizonte() {
        i.consentimentos.conceder("cli-001", "inst-horizonte");

        Patrimonio p = patrimonio.calcular(i.gateway.dados("cli-001"));

        assertThat(p.totalVisivel()).isEqualByComparingTo("1635000");
        assertThat(p.foraXp()).isEqualByComparingTo("735000");
        assertThat(p.porInstituicao().get(1).instituicaoId()).isEqualTo("inst-horizonte");
        assertThat(p.porProduto().get(0)).isEqualTo(new PorProduto("CDB", new java.math.BigDecimal("880000.00")));
    }

    @Test
    void coberturaDaMarinaAntesEDepois() {
        Cobertura antes = cobertura.calcular(i.gateway.dados("cli-001"));

        assertThat(antes.instituicoesDeclaradas()).isEqualTo(3);
        assertThat(antes.instituicoesConectadas()).isEqualTo(2);
        assertThat(antes.percentual()).isEqualTo(0.667);
        assertThat(antes.pendentes()).singleElement().satisfies(pend -> {
            assertThat(pend.instituicaoId()).isEqualTo("inst-horizonte");
            assertThat(pend.nome()).isEqualTo("Banco Horizonte");
            assertThat(pend.produtos()).containsExactly(ProdutoDeclarado.INVESTIMENTOS);
        });

        i.consentimentos.conceder("cli-001", "inst-horizonte");
        Cobertura depois = cobertura.calcular(i.gateway.dados("cli-001"));

        assertThat(depois.percentual()).isEqualTo(1.0);
        assertThat(depois.pendentes()).isEmpty();
    }
}
