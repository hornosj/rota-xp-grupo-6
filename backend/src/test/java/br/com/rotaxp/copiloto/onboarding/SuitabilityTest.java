package br.com.rotaxp.copiloto.onboarding;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.rotaxp.copiloto.config.OnboardingProps;
import br.com.rotaxp.copiloto.dominio.Enums.PerfilInvestidor;
import br.com.rotaxp.copiloto.dominio.Excecoes.RequisicaoInvalida;
import br.com.rotaxp.copiloto.dominio.Onboarding.PerguntaSuitability;
import br.com.rotaxp.copiloto.dominio.Onboarding.RespostaSuitability;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class SuitabilityTest {

    final Suitability s = new Suitability(new OnboardingProps("/onboarding/", 18, new OnboardingProps.Suitability(8, 12, 16)));

    /** Responde todas as perguntas com a mesma letra (a = 1 ponto ... d = 4 pontos). */
    List<RespostaSuitability> todas(String opcao) {
        return s.questionario().stream().map(p -> new RespostaSuitability(p.id(), opcao)).toList();
    }

    @Test
    void questionarioTemCincoPerguntasComQuatroOpcoesSemPontos() {
        List<PerguntaSuitability> q = s.questionario();
        assertThat(q).hasSize(5);
        assertThat(q).allSatisfy(p -> assertThat(p.opcoes()).hasSize(4));
    }

    @Test
    void perfilPelaPontuacao() {
        assertThat(s.avaliar(todas("a"))).isEqualTo(new Suitability.Resultado(PerfilInvestidor.CONSERVADOR, 5));
        assertThat(s.avaliar(todas("b"))).isEqualTo(new Suitability.Resultado(PerfilInvestidor.MODERADO, 10));
        assertThat(s.avaliar(todas("c"))).isEqualTo(new Suitability.Resultado(PerfilInvestidor.ARROJADO, 15));
        assertThat(s.avaliar(todas("d"))).isEqualTo(new Suitability.Resultado(PerfilInvestidor.AGRESSIVO, 20));
    }

    @Test
    void limitesSaoInclusivos() {
        assertThat(s.perfil(8)).isEqualTo(PerfilInvestidor.CONSERVADOR);
        assertThat(s.perfil(9)).isEqualTo(PerfilInvestidor.MODERADO);
        assertThat(s.perfil(12)).isEqualTo(PerfilInvestidor.MODERADO);
        assertThat(s.perfil(16)).isEqualTo(PerfilInvestidor.ARROJADO);
        assertThat(s.perfil(17)).isEqualTo(PerfilInvestidor.AGRESSIVO);
    }

    @Test
    void exigeUmaRespostaValidaPorPergunta() {
        List<RespostaSuitability> faltando = new ArrayList<>(todas("a"));
        faltando.remove(0);
        assertThatThrownBy(() -> s.avaliar(faltando)).isInstanceOf(RequisicaoInvalida.class).hasMessageContaining("Responda");

        List<RespostaSuitability> repetida = new ArrayList<>(todas("a"));
        repetida.add(repetida.get(0));
        assertThatThrownBy(() -> s.avaliar(repetida)).isInstanceOf(RequisicaoInvalida.class).hasMessageContaining("mais de uma vez");

        assertThatThrownBy(() -> s.avaliar(todas("z"))).isInstanceOf(RequisicaoInvalida.class).hasMessageContaining("Opção inválida");

        List<RespostaSuitability> extra = new ArrayList<>(todas("a"));
        extra.add(new RespostaSuitability("inventada", "a"));
        assertThatThrownBy(() -> s.avaliar(extra)).isInstanceOf(RequisicaoInvalida.class).hasMessageContaining("desconhecida");

        assertThatThrownBy(() -> s.avaliar(null)).isInstanceOf(RequisicaoInvalida.class);
    }
}
