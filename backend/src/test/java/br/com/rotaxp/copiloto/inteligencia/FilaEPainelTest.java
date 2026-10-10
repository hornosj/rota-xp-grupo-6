package br.com.rotaxp.copiloto.inteligencia;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotaxp.copiloto.consolidacao.Visao360Assembler;
import br.com.rotaxp.copiloto.dominio.ClienteResumo;
import br.com.rotaxp.copiloto.dominio.Enums.PosicaoXp;
import br.com.rotaxp.copiloto.dominio.Enums.TipoAcao;
import br.com.rotaxp.copiloto.dominio.ItemFila;
import br.com.rotaxp.copiloto.dominio.PainelCarteira;
import br.com.rotaxp.copiloto.openfinance.ConsentimentoAlterado;
import br.com.rotaxp.copiloto.support.CenarioBuilder;
import br.com.rotaxp.copiloto.support.Cenarios;
import br.com.rotaxp.copiloto.support.Infra;
import br.com.rotaxp.copiloto.support.Pilha;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class FilaEPainelTest {

    private Infra i;
    private Visao360Assembler assembler;
    private FilaService fila;
    private PainelService painel;

    @BeforeEach
    void setUp() {
        i = new Infra(Cenarios.juliana(Cenarios.marina(CenarioBuilder.comInstituicoesPadrao())).build());
        assembler = new Pilha().assembler(i);
        fila = new FilaService(assembler, Infra.demoProps());
        painel = new PainelService(assembler, Infra.demoProps(), Pilha.ALERTAS, i.dataReferencia);
    }

    private void conceder(String cli, String inst) {
        i.consentimentos.conceder(cli, inst);
        assembler.aoAlterarConsentimento(new ConsentimentoAlterado(cli, inst));
    }

    @Test
    void filaOrdenadaPorPrioridade() {
        List<ItemFila> itens = fila.fila();

        assertThat(itens).extracting(ItemFila::clienteId).containsExactly("cli-001", "cli-003");
        ItemFila marina = itens.get(0);
        assertThat(marina.posicao()).isEqualTo(1);
        assertThat(marina.prioridade()).isEqualTo(39.1);
        assertThat(marina.nome()).isEqualTo("Dra. Marina Costa");
        assertThat(marina.posicaoXp()).isEqualTo(PosicaoXp.SO_INVESTIMENTOS);
        assertThat(marina.motivos()).hasSize(4);
        assertThat(marina.acaoPrincipal().tipo()).isEqualTo(TipoAcao.APLICAR_SALDO_PARADO);
        assertThat(marina.novo()).isFalse();
        assertThat(itens.get(1).posicao()).isEqualTo(2);
    }

    @Test
    void depoisDoConsentimentoMarinaContinuaPrimeiraComNovo() {
        conceder("cli-001", "inst-horizonte");

        ItemFila marina = fila.fila().get(0);

        assertThat(marina.clienteId()).isEqualTo("cli-001");
        assertThat(marina.prioridade()).isEqualTo(100.0);
        assertThat(marina.novo()).isTrue();
        assertThat(marina.acaoPrincipal().tipo()).isEqualTo(TipoAcao.DIVERSIFICAR_FGC);
    }

    @Test
    void resumosDosClientes() {
        assertThat(fila.resumos()).extracting(ClienteResumo::id).containsExactly("cli-001", "cli-003");
        assertThat(fila.resumos().get(0).prioridade()).isEqualTo(39.1);
    }

    @Test
    void painelDaCarteira() {
        PainelCarteira p = painel.painel();

        assertThat(p.assessorId()).isEqualTo("ass-001");
        assertThat(p.totalClientes()).isEqualTo(2);
        assertThat(p.patrimonioNaXp()).isEqualByComparingTo("960000");          // 900k + 60k
        assertThat(p.patrimonioForaXpVisivel()).isEqualByComparingTo("107000");  // 85k + 22k
        assertThat(p.pctClientesXpPrincipal()).isZero();
        assertThat(p.distribuicaoPosicaoXp()).containsEntry(PosicaoXp.SO_INVESTIMENTOS, 2).containsEntry(PosicaoXp.PRINCIPAL, 0);
        assertThat(p.coberturaMedia()).isEqualTo(0.667);
        assertThat(p.consentimentosExpirando15d()).isZero();
        assertThat(p.clientesComAlertaAlto()).isZero();

        conceder("cli-001", "inst-horizonte");

        assertThat(painel.painel().clientesComAlertaAlto()).isEqualTo(1);
    }
}
