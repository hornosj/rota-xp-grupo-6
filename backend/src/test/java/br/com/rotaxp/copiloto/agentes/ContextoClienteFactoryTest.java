package br.com.rotaxp.copiloto.agentes;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.rotaxp.copiloto.consolidacao.Visao360Assembler;
import br.com.rotaxp.copiloto.dominio.Enums.PerfilInvestidor;
import br.com.rotaxp.copiloto.dominio.Enums.TipoAcao;
import br.com.rotaxp.copiloto.dominio.Excecoes.NaoEncontrado;
import br.com.rotaxp.copiloto.openfinance.ConsentimentoAlterado;
import br.com.rotaxp.copiloto.support.CenarioBuilder;
import br.com.rotaxp.copiloto.support.Cenarios;
import br.com.rotaxp.copiloto.support.Infra;
import br.com.rotaxp.copiloto.support.Pilha;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ContextoClienteFactoryTest {

    private Infra i;
    private Visao360Assembler assembler;
    private ContextoClienteFactory factory;

    @BeforeEach
    void setUp() {
        i = new Infra(Cenarios.marina(CenarioBuilder.comInstituicoesPadrao()).build());
        assembler = new Pilha().assembler(i);
        factory = new ContextoClienteFactory(assembler, i.dataReferencia);
        i.consentimentos.conceder("cli-001", "inst-horizonte");
        assembler.aoAlterarConsentimento(new ConsentimentoAlterado("cli-001", "inst-horizonte"));
    }

    @Test
    void contextoDaMensagemDeFgcDaMarina() {
        ContextoCliente c = factory.paraAcao("cli-001", "acao-cli-001-fgc_excedido-cong-horizonte");

        assertThat(c.clienteId()).isEqualTo("cli-001");
        assertThat(c.primeiroNome()).isEqualTo("Marina");
        assertThat(c.perfil()).isEqualTo(PerfilInvestidor.ARROJADO);
        assertThat(c.principalidade()).startsWith("Banco Aurora é a instituição principal");
        assertThat(c.acao().tipo()).isEqualTo(TipoAcao.DIVERSIFICAR_FGC);
        assertThat(c.acao().valor()).isEqualByComparingTo("400000");
        assertThat(c.acao().valorTexto()).isEqualTo("R$ 400 mil");
        assertThat(c.acao().instituicaoNome()).isEqualTo("Banco Horizonte");
        assertThat(c.acao().motivo()).contains("R$ 650 mil em CDB do Banco Horizonte");
        assertThat(c.eventosProximos()).singleElement().satisfies(e -> {
            assertThat(e.descricao()).isEqualTo("Aniversário da Sofia");
            assertThat(e.emDias()).isEqualTo(5);
        });
        assertThat(c.alertas()).anyMatch(a -> a.contains("acima da cobertura do FGC"));
    }

    @Test
    void contextoSemAcaoParaBriefing() {
        ContextoCliente c = factory.paraCliente("cli-001");

        assertThat(c.acao()).isNull();
        assertThat(c.patrimonioTexto()).isEqualTo("R$ 1,6 milhão visível, R$ 900 mil na XP");
        assertThat(c.acoesSugeridas()).isNotEmpty();
    }

    @Test
    void acaoInexistenteEhNaoEncontrada() {
        assertThatThrownBy(() -> factory.paraAcao("cli-001", "acao-xyz")).isInstanceOf(NaoEncontrado.class);
    }
}
