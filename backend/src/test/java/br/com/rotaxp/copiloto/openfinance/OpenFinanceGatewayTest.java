package br.com.rotaxp.copiloto.openfinance;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotaxp.copiloto.dominio.PosicaoInvestimento;
import br.com.rotaxp.copiloto.support.CenarioBuilder;
import br.com.rotaxp.copiloto.support.Cenarios;
import br.com.rotaxp.copiloto.support.Infra;
import org.junit.jupiter.api.Test;

class OpenFinanceGatewayTest {

    private Infra infra(CenarioBuilder b) { return new Infra(b.build()); }

    @Test
    void horizonteFicaInvisivelParaMarinaEnquantoConsentimentoEstaPendente() {
        Infra i = infra(Cenarios.marina(CenarioBuilder.comInstituicoesPadrao()));

        DadosVisiveis d = i.gateway.dados("cli-001");

        assertThat(d.investimentos()).extracting(PosicaoInvestimento::instituicaoId).doesNotContain("inst-horizonte");
        assertThat(d.instituicoesVisiveis()).containsOnlyKeys("inst-xp", "inst-aurora");
    }

    @Test
    void horizonteApareceDepoisDeConceder() {
        Infra i = infra(Cenarios.marina(CenarioBuilder.comInstituicoesPadrao()));

        i.consentimentos.conceder("cli-001", "inst-horizonte");
        DadosVisiveis d = i.gateway.dados("cli-001");

        assertThat(d.investimentos()).extracting(PosicaoInvestimento::instituicaoId).contains("inst-horizonte");
        assertThat(d.instituicoesVisiveis()).containsKey("inst-horizonte");
    }

    @Test
    void consentimentoInternoDaXpCobreTodosOsEscopos() {
        Infra i = infra(Cenarios.marina(CenarioBuilder.comInstituicoesPadrao()));

        DadosVisiveis d = i.gateway.dados("cli-001");

        assertThat(d.investimentos()).filteredOn(p -> p.instituicaoId().equals("inst-xp")).hasSize(5);
    }

    @Test
    void soEntregaDadosDoEscopoConsentido() {
        // Juliana: Ipê só com CONTAS; Aurora (cartão) pendente → faturas da Aurora não aparecem
        Infra i = infra(Cenarios.juliana(CenarioBuilder.comInstituicoesPadrao()));

        DadosVisiveis d = i.gateway.dados("cli-003");

        assertThat(d.contas()).hasSize(1);
        assertThat(d.transacoes()).isNotEmpty();
        assertThat(d.faturas()).isEmpty();
        assertThat(d.visivel("inst-aurora", br.com.rotaxp.copiloto.dominio.Enums.Escopo.CARTOES)).isFalse();
    }
}
