package br.com.rotaxp.copiloto.openfinance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.rotaxp.copiloto.config.ConviteProps;
import br.com.rotaxp.copiloto.demo.DataReferencia;
import br.com.rotaxp.copiloto.dominio.Convite;
import br.com.rotaxp.copiloto.dominio.Convite.StatusConvite;
import br.com.rotaxp.copiloto.dominio.Enums.Escopo;
import br.com.rotaxp.copiloto.dominio.Enums.StatusConsentimento;
import br.com.rotaxp.copiloto.dominio.Excecoes.Conflito;
import br.com.rotaxp.copiloto.dominio.Excecoes.Expirado;
import br.com.rotaxp.copiloto.dominio.Excecoes.NaoEncontrado;
import br.com.rotaxp.copiloto.support.CenarioBuilder;
import br.com.rotaxp.copiloto.support.Cenarios;
import br.com.rotaxp.copiloto.support.Infra;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ConviteServiceTest {

    /** Relógio que dá para avançar. */
    static class Relogio extends Clock {
        Instant agora = Instant.parse("2026-10-11T12:00:00Z");
        @Override public ZoneId getZone() { return DataReferencia.ZONA; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return agora; }
    }

    static final ConviteProps PROPS = new ConviteProps("http://localhost:3000/convite/", 48, 12);

    private Infra i;
    private Relogio relogio;
    private ConviteService convites;

    @BeforeEach
    void setUp() {
        i = new Infra(Cenarios.marina(CenarioBuilder.comInstituicoesPadrao()).build());
        relogio = new Relogio();
        convites = novoServico();
    }

    private ConviteService novoServico() {
        return new ConviteService(i.repo, i.consentimentos, new DataReferencia(CenarioBuilder.REF, relogio), PROPS);
    }

    private StatusConsentimento statusHorizonte() {
        return i.consentimentos.listar("cli-001").stream().filter(c -> c.instituicaoId().equals("inst-horizonte"))
                .findFirst().orElseThrow().status();
    }

    @Test
    void convidarCriaUmConvitePendenteComOsEscoposDoConsentimentoPendente() {
        Convite c = convites.convidar("cli-001", "inst-horizonte");

        assertThat(c.status()).isEqualTo(StatusConvite.PENDENTE);
        assertThat(c.clienteId()).isEqualTo("cli-001");
        assertThat(c.instituicaoNome()).isEqualTo("Banco Horizonte");
        assertThat(c.escopos()).containsExactly(Escopo.INVESTIMENTOS);
        assertThat(c.prazoMeses()).isEqualTo(12);
        assertThat(c.token()).startsWith("cv-").hasSize(13);
        assertThat(c.link()).isEqualTo("http://localhost:3000/convite/" + c.token());
        assertThat(c.criadoEm().toLocalDate()).isEqualTo(CenarioBuilder.REF);
        assertThat(Duration.between(c.criadoEm(), c.expiraEm())).isEqualTo(Duration.ofHours(48));
    }

    @Test
    void tokenEhDeterministicoEConvidarDeNovoReaproveitaOPendente() {
        Convite primeiro = convites.convidar("cli-001", "inst-horizonte");

        assertThat(convites.convidar("cli-001", "inst-horizonte")).isEqualTo(primeiro);
        assertThat(novoServico().convidar("cli-001", "inst-horizonte").token()).isEqualTo(primeiro.token());
        assertThat(convites.listar("cli-001")).containsExactly(primeiro);
    }

    @Test
    void naoConvidaParaInstituicaoJaConectadaNemInexistente() {
        assertThatThrownBy(() -> convites.convidar("cli-001", "inst-aurora")).isInstanceOf(Conflito.class);
        assertThatThrownBy(() -> convites.convidar("cli-001", "inst-nao-existe")).isInstanceOf(NaoEncontrado.class);
        assertThatThrownBy(() -> convites.convidar("cli-999", "inst-horizonte")).isInstanceOf(NaoEncontrado.class);
    }

    @Test
    void confirmarConcedeOConsentimentoEPublicaOEvento() {
        Convite c = convites.convidar("cli-001", "inst-horizonte");

        Convite confirmado = convites.confirmar(c.token());

        assertThat(confirmado.status()).isEqualTo(StatusConvite.CONFIRMADO);
        assertThat(statusHorizonte()).isEqualTo(StatusConsentimento.ATIVO);
        assertThat(i.eventos).containsExactly(new ConsentimentoAlterado("cli-001", "inst-horizonte"));
        assertThat(convites.buscar(c.token()).status()).isEqualTo(StatusConvite.CONFIRMADO);
    }

    @Test
    void confirmarDuasVezesEhConflito() {
        Convite c = convites.convidar("cli-001", "inst-horizonte");
        convites.confirmar(c.token());

        assertThatThrownBy(() -> convites.confirmar(c.token())).isInstanceOf(Conflito.class);
    }

    @Test
    void conviteExpiraEm48Horas() {
        Convite c = convites.convidar("cli-001", "inst-horizonte");
        relogio.agora = relogio.agora.plus(Duration.ofHours(49));

        assertThat(convites.buscar(c.token()).status()).isEqualTo(StatusConvite.EXPIRADO);
        assertThatThrownBy(() -> convites.confirmar(c.token())).isInstanceOf(Expirado.class);
        assertThat(statusHorizonte()).isEqualTo(StatusConsentimento.PENDENTE);
        // um convite novo substitui o expirado
        assertThat(convites.convidar("cli-001", "inst-horizonte").token()).isNotEqualTo(c.token());
    }

    @Test
    void tokenInexistenteEhNaoEncontrado() {
        assertThatThrownBy(() -> convites.buscar("cv-nao-existe")).isInstanceOf(NaoEncontrado.class);
        assertThatThrownBy(() -> convites.confirmar("cv-nao-existe")).isInstanceOf(NaoEncontrado.class);
    }

    @Test
    void limparApagaOsConvitesEOTokenSeRepete() {
        String token = convites.convidar("cli-001", "inst-horizonte").token();

        convites.limpar();

        assertThat(convites.listar("cli-001")).isEmpty();
        assertThat(convites.convidar("cli-001", "inst-horizonte").token()).isEqualTo(token);
    }

    @Test
    void semConsentimentoPendenteUsaOsProdutosDeclarados() {
        i.consentimentos.revogar("cli-001", "inst-aurora");

        Convite c = convites.convidar("cli-001", "inst-aurora");

        assertThat(c.escopos()).containsExactly(Escopo.CONTAS, Escopo.CARTOES, Escopo.CREDITO);
    }
}
