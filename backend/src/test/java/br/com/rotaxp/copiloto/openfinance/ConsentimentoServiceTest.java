package br.com.rotaxp.copiloto.openfinance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.rotaxp.copiloto.dominio.ConsentimentoView;
import br.com.rotaxp.copiloto.dominio.Enums.Escopo;
import br.com.rotaxp.copiloto.dominio.Enums.StatusConsentimento;
import br.com.rotaxp.copiloto.dominio.Excecoes.Conflito;
import br.com.rotaxp.copiloto.dominio.Excecoes.NaoEncontrado;
import br.com.rotaxp.copiloto.support.CenarioBuilder;
import br.com.rotaxp.copiloto.support.Cenarios;
import br.com.rotaxp.copiloto.support.Infra;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ConsentimentoServiceTest {

    private Infra i;

    @BeforeEach
    void setUp() {
        i = new Infra(Cenarios.marina(CenarioBuilder.comInstituicoesPadrao()).build());
    }

    private ConsentimentoView horizonte() {
        return i.consentimentos.listar("cli-001").stream()
                .filter(c -> c.instituicaoId().equals("inst-horizonte")).findFirst().orElseThrow();
    }

    @Test
    void listarTrazNomeDaInstituicao() {
        assertThat(horizonte().instituicaoNome()).isEqualTo("Banco Horizonte");
        assertThat(horizonte().status()).isEqualTo(StatusConsentimento.PENDENTE);
    }

    @Test
    void concederAtivaComOsEscoposPedidosEPrazoDe12Meses() {
        i.consentimentos.conceder("cli-001", "inst-horizonte");

        ConsentimentoView c = horizonte();
        assertThat(c.status()).isEqualTo(StatusConsentimento.ATIVO);
        assertThat(c.escopos()).containsExactly(Escopo.INVESTIMENTOS);
        assertThat(c.concedidoEm()).isEqualTo(CenarioBuilder.REF);
        assertThat(c.expiraEm()).isEqualTo(CenarioBuilder.REF.plusDays(365));
    }

    @Test
    void concederPublicaConsentimentoAlterado() {
        i.consentimentos.conceder("cli-001", "inst-horizonte");

        assertThat(i.eventos).containsExactly(new ConsentimentoAlterado("cli-001", "inst-horizonte"));
    }

    @Test
    void concederJaAtivoEhConflito() {
        assertThatThrownBy(() -> i.consentimentos.conceder("cli-001", "inst-aurora")).isInstanceOf(Conflito.class);
    }

    @Test
    void instituicaoOuClienteInexistenteEhNaoEncontrado() {
        assertThatThrownBy(() -> i.consentimentos.conceder("cli-001", "inst-nao-existe")).isInstanceOf(NaoEncontrado.class);
        assertThatThrownBy(() -> i.consentimentos.conceder("cli-999", "inst-aurora")).isInstanceOf(NaoEncontrado.class);
    }

    @Test
    void concederInstituicaoSemConsentimentoPrevioUsaEscoposDosProdutosDeclarados() {
        i.consentimentos.revogar("cli-001", "inst-aurora");
        i.consentimentos.conceder("cli-001", "inst-aurora");

        ConsentimentoView aurora = i.consentimentos.listar("cli-001").stream()
                .filter(c -> c.instituicaoId().equals("inst-aurora")).findFirst().orElseThrow();
        assertThat(aurora.status()).isEqualTo(StatusConsentimento.ATIVO);
        assertThat(aurora.escopos()).containsExactly(Escopo.CONTAS, Escopo.CARTOES, Escopo.CREDITO);
    }

    @Test
    void revogarTornaDadosInvisiveis() {
        i.consentimentos.revogar("cli-001", "inst-aurora");

        assertThat(i.gateway.dados("cli-001").contas()).isEmpty();
        assertThat(i.eventos).hasSize(1);
    }

    @Test
    void naoRevogaConsentimentoInternoDaXp() {
        assertThatThrownBy(() -> i.consentimentos.revogar("cli-001", "inst-xp")).isInstanceOf(Conflito.class);
    }
}
