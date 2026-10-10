package br.com.rotaxp.copiloto.consolidacao;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotaxp.copiloto.dominio.Alerta;
import br.com.rotaxp.copiloto.dominio.ConsentimentoView;
import br.com.rotaxp.copiloto.dominio.Enums.TipoAlerta;
import br.com.rotaxp.copiloto.dominio.Visao360;
import br.com.rotaxp.copiloto.openfinance.ConsentimentoAlterado;
import br.com.rotaxp.copiloto.support.CenarioBuilder;
import br.com.rotaxp.copiloto.support.Cenarios;
import br.com.rotaxp.copiloto.support.Infra;
import br.com.rotaxp.copiloto.support.Pilha;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class Visao360AssemblerTest {

    private Infra i;
    private Visao360Assembler assembler;

    @BeforeEach
    void setUp() {
        i = new Infra(Cenarios.juliana(Cenarios.marina(CenarioBuilder.comInstituicoesPadrao())).build());
        assembler = new Pilha().assembler(i);
    }

    private void conceder(String cli, String inst) {
        i.consentimentos.conceder(cli, inst);
        assembler.aoAlterarConsentimento(new ConsentimentoAlterado(cli, inst));
    }

    @Test
    void visao360DaMarinaAntes() {
        Visao360 v = assembler.visao360("cli-001");

        assertThat(v.cliente().nome()).isEqualTo("Dra. Marina Costa");
        assertThat(v.cobertura().percentual()).isEqualTo(0.667);
        assertThat(v.patrimonio().totalVisivel()).isEqualByComparingTo("985000");
        assertThat(v.principalidade().instituicaoPrincipalId()).isEqualTo("inst-aurora");
        assertThat(v.fluxoCaixa().custoVidaMensal()).isEqualByComparingTo("24000");
        assertThat(v.alertas()).hasSize(3).noneMatch(Alerta::novo).allMatch(a -> a.detectadoEm() != null);
        assertThat(v.acoes()).isNotEmpty();
        assertThat(v.consentimentos()).extracting(ConsentimentoView::instituicaoNome)
                .containsExactlyInAnyOrder("XP Investimentos", "Banco Aurora", "Banco Horizonte");
        assertThat(v.atualizadoEm().toLocalDate()).isEqualTo(CenarioBuilder.REF);
    }

    @Test
    void depoisDeConcederOsAlertasNovosAparecemMarcados() {
        conceder("cli-001", "inst-horizonte");

        Visao360 v = assembler.visao360("cli-001");

        assertThat(v.patrimonio().totalVisivel()).isEqualByComparingTo("1635000");
        assertThat(v.cobertura().percentual()).isEqualTo(1.0);
        Alerta fgc = v.alertas().stream().filter(a -> a.tipo() == TipoAlerta.FGC_EXCEDIDO).findFirst().orElseThrow();
        assertThat(fgc.novo()).isTrue();
        assertThat(v.alertas()).filteredOn(a -> a.tipo() == TipoAlerta.SALDO_PARADO).allMatch(a -> !a.novo());
    }

    @Test
    void cacheEhPorClienteEInvalidadoPeloEvento() {
        AnaliseCliente antes = assembler.analisar("cli-001");
        assertThat(assembler.analisar("cli-001").base()).isSameAs(antes.base());

        i.consentimentos.conceder("cli-001", "inst-horizonte");
        assertThat(assembler.analisar("cli-001").base()).isSameAs(antes.base());   // sem evento, segue no cache

        assembler.aoAlterarConsentimento(new ConsentimentoAlterado("cli-001", "inst-horizonte"));
        assertThat(assembler.analisar("cli-001").base()).isNotSameAs(antes.base());
        assertThat(assembler.analisar("cli-003").prioridade().prioridade()).isEqualTo(34.3);
    }

    @Test
    void marinaPassaDe39vir1Para100() {
        assertThat(assembler.analisar("cli-001").prioridade().prioridade()).isEqualTo(39.1);

        conceder("cli-001", "inst-horizonte");

        assertThat(assembler.analisar("cli-001").prioridade().prioridade()).isEqualTo(100.0);
    }
}
