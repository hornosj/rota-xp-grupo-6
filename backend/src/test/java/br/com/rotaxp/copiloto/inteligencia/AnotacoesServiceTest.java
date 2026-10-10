package br.com.rotaxp.copiloto.inteligencia;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotaxp.copiloto.dominio.ContextoAssessor;
import br.com.rotaxp.copiloto.dominio.Enums.OrigemAnotacao;
import br.com.rotaxp.copiloto.dominio.Enums.TipoNecessidade;
import br.com.rotaxp.copiloto.dominio.RecomendacaoProduto;
import java.time.LocalDate;
import br.com.rotaxp.copiloto.support.Pilha;
import java.util.List;
import org.junit.jupiter.api.Test;

class AnotacoesServiceTest {

    static final LocalDate REF = LocalDate.of(2026, 10, 11);

    private final AnotacoesService service = new AnotacoesService(Pilha.ANOTACOES);

    private static RecomendacaoProduto rec(TipoNecessidade t, String produto, String motivo) {
        return new RecomendacaoProduto(t, produto, "d", motivo, false, false);
    }

    @Test
    void registraAnotacoesMaisRecentesPrimeiroSemMisturarClientes() {
        service.registrar("cli-003", "Bateu o carro.", OrigemAnotacao.AUDIO, REF, "Juliana bateu o carro.", List.of());
        service.registrar("cli-003", "Vai casar.", OrigemAnotacao.TEXTO, REF, "Juliana vai casar.", List.of());
        service.registrar("cli-001", "Outra.", OrigemAnotacao.TEXTO, REF, "r", List.of());

        ContextoAssessor c = service.contexto("cli-003");

        assertThat(c.clienteId()).isEqualTo("cli-003");
        assertThat(c.anotacoes()).extracting(ContextoAssessor.Anotacao::texto).containsExactly("Vai casar.", "Bateu o carro.");
        assertThat(c.anotacoes().get(1).origem()).isEqualTo(OrigemAnotacao.AUDIO);
        assertThat(c.anotacoes().get(1).data()).isEqualTo(REF);
        assertThat(c.anotacoes()).extracting(ContextoAssessor.Anotacao::id).doesNotHaveDuplicates();
        assertThat(service.contexto("cli-999").anotacoes()).isEmpty();
    }

    @Test
    void recomendacaoNovaDaMesmaNecessidadeSubstituiAAntiga() {
        service.registrar("cli-003", "a", OrigemAnotacao.TEXTO, REF, "r",
                List.of(rec(TipoNecessidade.PROTECAO_VEICULO, "Seguro auto", "bateu o carro")));
        service.registrar("cli-003", "b", OrigemAnotacao.TEXTO, REF, "r", List.of(
                rec(TipoNecessidade.RESERVA_EMERGENCIA, "Reserva", "demitido"),
                rec(TipoNecessidade.PROTECAO_VEICULO, "Seguro auto", "bateu de novo")));

        assertThat(service.contexto("cli-003").recomendacoes()).extracting(RecomendacaoProduto::motivo)
                .containsExactly("demitido", "bateu de novo");   // ordem da nota mais recente; a antiga sai
    }

    @Test
    void saberQueJaTemOProdutoNaoSePerdeComNotaNovaQueNaoFalaDisso() {
        service.registrar("cli-003", "a", OrigemAnotacao.AUDIO, REF, "r", List.of(
                new RecomendacaoProduto(TipoNecessidade.PROTECAO_VEICULO, "Revisão do seguro auto", "d", "tá com seguro", true, false)));
        service.registrar("cli-003", "b", OrigemAnotacao.AUDIO, REF, "r", List.of(
                rec(TipoNecessidade.PROTECAO_VEICULO, "Seguro auto", "bateu o carro de novo")));

        assertThat(service.contexto("cli-003").recomendacoes()).singleElement()
                .satisfies(r -> assertThat(r.produto()).isEqualTo("Revisão do seguro auto"));
    }

    @Test
    void textosParaOLlmRespeitamOLimiteEmOrdemCronologica() {
        for (int n = 1; n <= 7; n++) service.registrar("cli-003", "nota " + n, OrigemAnotacao.TEXTO, REF, "r", List.of());

        assertThat(service.textosRecentes("cli-003")).containsExactly("nota 3", "nota 4", "nota 5", "nota 6", "nota 7");
    }

    @Test
    void limparApagaTudo() {
        service.registrar("cli-003", "a", OrigemAnotacao.TEXTO, REF, "r",
                List.of(rec(TipoNecessidade.PROTECAO_VEICULO, "Seguro auto", "m")));

        service.limpar();

        assertThat(service.contexto("cli-003").anotacoes()).isEmpty();
        assertThat(service.contexto("cli-003").recomendacoes()).isEmpty();
    }
}
