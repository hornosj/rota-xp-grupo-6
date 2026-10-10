package br.com.rotaxp.copiloto.inteligencia;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotaxp.copiloto.dominio.Enums.TipoNecessidade;
import br.com.rotaxp.copiloto.dominio.Necessidade;
import br.com.rotaxp.copiloto.dominio.RecomendacaoProduto;
import br.com.rotaxp.copiloto.support.Pilha;
import java.util.List;
import org.junit.jupiter.api.Test;

class RecomendadorProdutosTest {

    private final RecomendadorProdutos recomendador = new RecomendadorProdutos(Pilha.ANOTACOES);

    @Test
    void mapeiaNecessidadeParaOProdutoDoCatalogoComOMotivo() {
        List<RecomendacaoProduto> r = recomendador.recomendar(
                List.of(new Necessidade(TipoNecessidade.PROTECAO_VEICULO, "Bateu o carro semana passada", false)));

        assertThat(r).containsExactly(new RecomendacaoProduto(TipoNecessidade.PROTECAO_VEICULO, "Seguro auto",
                "Cobre colisão, roubo e terceiros.", "Bateu o carro semana passada", false, false));
    }

    @Test
    void ignoraNecessidadeForaDoCatalogoERepetida() {
        List<RecomendacaoProduto> r = recomendador.recomendar(List.of(
                new Necessidade(TipoNecessidade.VIAGEM, "vai viajar", false),
                new Necessidade(TipoNecessidade.RESERVA_EMERGENCIA, "foi demitido", false),
                new Necessidade(TipoNecessidade.RESERVA_EMERGENCIA, "outra menção", false)));

        assertThat(r).extracting(RecomendacaoProduto::produto).containsExactly("Reserva de emergência");
        assertThat(r.get(0).motivo()).isEqualTo("foi demitido");
    }

    @Test
    void quemJaPossuiRecebeARevisaoDoProduto() {
        List<RecomendacaoProduto> r = recomendador.recomendar(
                List.of(new Necessidade(TipoNecessidade.PROTECAO_VEICULO, "bateu o carro", true)));

        assertThat(r).singleElement().satisfies(x -> {
            assertThat(x.produto()).isEqualTo("Revisão do seguro auto");
            assertThat(x.descricao()).isEqualTo("Acionar o sinistro.");
            assertThat(x.revisao()).isTrue();
        });
    }

    @Test
    void jaPossuiSemRevisaoNoCatalogoUsaOProdutoNormal() {
        assertThat(recomendador.recomendar(List.of(new Necessidade(TipoNecessidade.RESERVA_EMERGENCIA, "x", true))))
                .singleElement().satisfies(x -> {
                    assertThat(x.produto()).isEqualTo("Reserva de emergência");
                    assertThat(x.revisao()).isFalse();
                });
    }

    @Test
    void momentoDelicadoVemPrimeiroEMarcado() {
        List<RecomendacaoProduto> r = recomendador.recomendar(List.of(
                new Necessidade(TipoNecessidade.PROTECAO_VEICULO, "bateu o carro", false),
                new Necessidade(TipoNecessidade.LUTO, "perdeu o filho", false)));

        assertThat(r).extracting(RecomendacaoProduto::necessidade)
                .containsExactly(TipoNecessidade.LUTO, TipoNecessidade.PROTECAO_VEICULO);
        assertThat(r.get(0).sensivel()).isTrue();
        assertThat(r.get(1).sensivel()).isFalse();
    }

    @Test
    void semNecessidadesNaoRecomenda() {
        assertThat(recomendador.recomendar(null)).isEmpty();
        assertThat(recomendador.recomendar(List.of())).isEmpty();
    }
}
