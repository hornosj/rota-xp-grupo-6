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
                List.of(new Necessidade(TipoNecessidade.PROTECAO_VEICULO, "Bateu o carro semana passada")));

        assertThat(r).containsExactly(new RecomendacaoProduto(TipoNecessidade.PROTECAO_VEICULO, "Seguro auto",
                "Cobre colisão, roubo e terceiros.", "Bateu o carro semana passada"));
    }

    @Test
    void ignoraNecessidadeForaDoCatalogoERepetida() {
        List<RecomendacaoProduto> r = recomendador.recomendar(List.of(
                new Necessidade(TipoNecessidade.VIAGEM, "vai viajar"),
                new Necessidade(TipoNecessidade.RESERVA_EMERGENCIA, "foi demitido"),
                new Necessidade(TipoNecessidade.RESERVA_EMERGENCIA, "outra menção")));

        assertThat(r).extracting(RecomendacaoProduto::produto).containsExactly("Reserva de emergência");
        assertThat(r.get(0).motivo()).isEqualTo("foi demitido");
    }

    @Test
    void semNecessidadesNaoRecomenda() {
        assertThat(recomendador.recomendar(null)).isEmpty();
        assertThat(recomendador.recomendar(List.of())).isEmpty();
    }
}
