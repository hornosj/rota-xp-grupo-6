package br.com.rotaxp.copiloto.inteligencia;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.rotaxp.copiloto.config.EdicaoProps;
import br.com.rotaxp.copiloto.dominio.Cliente;
import br.com.rotaxp.copiloto.dominio.Edicao.AlteracaoCampo;
import br.com.rotaxp.copiloto.dominio.Edicao.CampoCadastro;
import br.com.rotaxp.copiloto.dominio.Edicao.CamposExtraidos;
import br.com.rotaxp.copiloto.dominio.Edicao.EdicaoCadastro;
import br.com.rotaxp.copiloto.dominio.Edicao.PropostaEdicao;
import br.com.rotaxp.copiloto.dominio.Enums.GeradoPor;
import br.com.rotaxp.copiloto.dominio.Enums.PerfilInvestidor;
import br.com.rotaxp.copiloto.dominio.Excecoes.RequisicaoInvalida;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Edição do cadastro por voz: o que o Copiloto entendeu só vira proposta depois das regras. */
class RegrasCadastroTest {

    private final RegrasCadastro regras = new RegrasCadastro(new EdicaoProps(18, 120, 120, 4000));
    private final Cliente patricia = new Cliente("cli-004", "Patrícia Gomes", "000.000.004-04", 68, "Professora aposentada",
            "Bauru/SP", PerfilInvestidor.CONSERVADOR, "ass-001", true, List.of(), List.of(), List.of());

    private static CamposExtraidos ditos(String nome, String idade, String profissao, String cidade, String perfil) {
        return new CamposExtraidos(nome, idade, profissao, cidade, perfil, GeradoPor.live);
    }

    @Test
    void propoeSoOQueMudouComValorAtualENovoNormalizados() {
        PropostaEdicao p = regras.propor(patricia, ditos(null, "69 anos", "consultora educacional", "campinas - sp", null),
                "A Patrícia fez 69 anos, voltou a trabalhar e se mudou para Campinas.");

        assertThat(p.alteracoes()).containsExactly(
                new AlteracaoCampo(CampoCadastro.IDADE, "68", "69"),
                new AlteracaoCampo(CampoCadastro.PROFISSAO, "Professora aposentada", "Consultora educacional"),
                new AlteracaoCampo(CampoCadastro.CIDADE, "Bauru/SP", "Campinas/SP"));
        assertThat(p.avisos()).isEmpty();
        assertThat(p.clienteId()).isEqualTo("cli-004");
        assertThat(p.transcricao()).startsWith("A Patrícia fez 69 anos");
        assertThat(p.geradoPor()).isEqualTo(GeradoPor.live);
    }

    @Test
    void valorIgualAoAtualNaoEntraNaProposta() {
        PropostaEdicao p = regras.propor(patricia, ditos("patrícia gomes", "68", "Professora aposentada.", "bauru/sp", "conservador"), "t");

        assertThat(p.alteracoes()).isEmpty();
        assertThat(p.avisos()).isEmpty();
    }

    @Test
    void valorInvalidoViraAvisoEmVezDeAlteracao() {
        PropostaEdicao p = regras.propor(patricia, ditos("Patrícia", "150", "  ", "Rua 7", null), "t");

        assertThat(p.alteracoes()).isEmpty();
        assertThat(p.avisos()).hasSize(3);
        assertThat(p.avisos().get(0)).contains("nome e sobrenome");
        assertThat(p.avisos().get(1)).contains("150", "18 a 120 anos");
        assertThat(p.avisos().get(2)).contains("Cidade", "Rua 7");
    }

    @Test
    void perfilDeInvestidorNaoMudaPorVozMasOAssessorEhAvisado() {
        PropostaEdicao p = regras.propor(patricia, ditos(null, null, null, null, "Moderada"), "t");

        assertThat(p.alteracoes()).isEmpty();
        assertThat(p.avisos()).singleElement().asString()
                .contains("de Conservador para Moderado", "questionário de suitability");
    }

    @Test
    void cidadeEhNormalizadaParaCidadeBarraUf() {
        assertThat(regras.cidade("rio de janeiro, rj")).isEqualTo("Rio de Janeiro/RJ");
        assertThat(regras.cidade("Foz do Iguaçu/pr.")).isEqualTo("Foz do Iguaçu/PR");
        assertThat(regras.cidade("SÃO PAULO")).isEqualTo("São Paulo");
        assertThat(regras.cidade("Embu-Guaçu")).isEqualTo("Embu-Guaçu");
    }

    @Test
    void nomeAceitaTituloEPadronizaMaiusculas() {
        assertThat(regras.nome("dra. marina costa")).isEqualTo("Dra. Marina Costa");
        assertThat(regras.nome("PATRÍCIA GOMES DA SILVA")).isEqualTo("Patrícia Gomes da Silva");
        assertThatThrownBy(() -> regras.nome("Dra. Marina")).isInstanceOf(RequisicaoInvalida.class);
        assertThatThrownBy(() -> regras.nome("Patrícia 2")).isInstanceOf(RequisicaoInvalida.class);
    }

    @Test
    void aplicarMudaSoOsCamposInformados() {
        Cliente c = regras.aplicar(patricia, new EdicaoCadastro(null, 69, null, "campinas/sp"));

        assertThat(c).isEqualTo(patricia.comCadastro("Patrícia Gomes", 69, "Professora aposentada", "Campinas/SP"));
        assertThat(c.perfil()).isEqualTo(PerfilInvestidor.CONSERVADOR);
    }

    @Test
    void aplicarRecusaValorInvalidoOuEdicaoVazia() {
        assertThatThrownBy(() -> regras.aplicar(patricia, new EdicaoCadastro(null, 15, null, null)))
                .isInstanceOf(RequisicaoInvalida.class).hasMessageContaining("18 a 120 anos");
        assertThatThrownBy(() -> regras.aplicar(patricia, new EdicaoCadastro("X", null, null, null)))
                .isInstanceOf(RequisicaoInvalida.class).hasMessageContaining("nome e sobrenome");
        assertThatThrownBy(() -> regras.aplicar(patricia, new EdicaoCadastro(null, null, null, null)))
                .isInstanceOf(RequisicaoInvalida.class).hasMessageContaining("Nada para alterar");
        assertThatThrownBy(() -> regras.aplicar(patricia, null)).isInstanceOf(RequisicaoInvalida.class);
    }
}
