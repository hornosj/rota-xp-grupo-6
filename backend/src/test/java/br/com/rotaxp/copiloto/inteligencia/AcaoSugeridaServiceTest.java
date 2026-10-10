package br.com.rotaxp.copiloto.inteligencia;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotaxp.copiloto.dominio.AcaoSugerida;
import br.com.rotaxp.copiloto.dominio.Enums.TipoAcao;
import br.com.rotaxp.copiloto.support.CenarioBuilder;
import br.com.rotaxp.copiloto.support.Cenarios;
import br.com.rotaxp.copiloto.support.Infra;
import br.com.rotaxp.copiloto.support.Pilha;
import java.util.List;
import org.junit.jupiter.api.Test;

class AcaoSugeridaServiceTest {

    private final Pilha pilha = new Pilha();
    private final AcaoSugeridaService service = new AcaoSugeridaService(Pilha.ALERTAS, Pilha.PREMISSAS);

    private List<AcaoSugerida> acoes(Infra i, String clienteId) {
        Pilha.Analise a = pilha.analisar(i.gateway.dados(clienteId));
        return service.gerar(a.dados(), a.alertas(), a.cobertura(), a.fluxo().fluxo(), a.prioridade());
    }

    private static AcaoSugerida acao(List<AcaoSugerida> acoes, TipoAcao tipo) {
        return acoes.stream().filter(a -> a.tipo() == tipo).findFirst().orElseThrow();
    }

    @Test
    void marinaAntes() {
        List<AcaoSugerida> acoes = acoes(new Infra(Cenarios.marina(CenarioBuilder.comInstituicoesPadrao()).build()), "cli-001");

        assertThat(acoes).extracting(AcaoSugerida::tipo).containsExactly(
                TipoAcao.APLICAR_SALDO_PARADO, TipoAcao.APORTE_PROGRAMADO, TipoAcao.CONTATO_RELACIONAMENTO, TipoAcao.CONVIDAR_CONEXAO);
        AcaoSugerida saldo = acao(acoes, TipoAcao.APLICAR_SALDO_PARADO);
        assertThat(saldo.titulo()).isEqualTo("Levar R$ 61 mil parados para liquidez diária");
        assertThat(saldo.impactoEstimado()).isEqualTo("Cerca de R$ 486 por mês a 100% do CDI");
        assertThat(saldo.principal()).isTrue();
        assertThat(saldo.alertaIds()).containsExactly("alr-cli-001-saldo_parado");
        assertThat(acao(acoes, TipoAcao.APORTE_PROGRAMADO).titulo()).isEqualTo("Propor aporte programado de R$ 7 mil/mês (50% da sobra)");
        assertThat(acao(acoes, TipoAcao.CONTATO_RELACIONAMENTO).titulo()).isEqualTo("Aniversário da Sofia em 5 dias");
        AcaoSugerida convite = acao(acoes, TipoAcao.CONVIDAR_CONEXAO);
        assertThat(convite.titulo()).isEqualTo("Convidar a conectar o Banco Horizonte pelo app");
        assertThat(convite.alertaIds()).isEmpty();
        assertThat(acoes).filteredOn(AcaoSugerida::principal).hasSize(1);
    }

    @Test
    void marinaDepoisTemDiversificarFgcComoPrincipal() {
        Infra i = new Infra(Cenarios.marina(CenarioBuilder.comInstituicoesPadrao()).build());
        i.consentimentos.conceder("cli-001", "inst-horizonte");

        List<AcaoSugerida> acoes = acoes(i, "cli-001");

        AcaoSugerida fgc = acoes.get(0);
        assertThat(fgc.tipo()).isEqualTo(TipoAcao.DIVERSIFICAR_FGC);
        assertThat(fgc.principal()).isTrue();
        assertThat(fgc.titulo()).isEqualTo("Distribuir R$ 400 mil entre emissores para ter 100% de cobertura do FGC");
        assertThat(fgc.id()).isEqualTo("acao-cli-001-fgc_excedido-cong-horizonte");
        assertThat(acao(acoes, TipoAcao.REDUZIR_CONCENTRACAO).titulo()).isEqualTo("Reduzir exposição sem garantia ao Banco Horizonte");
        assertThat(acoes).extracting(AcaoSugerida::tipo).doesNotContain(TipoAcao.CONVIDAR_CONEXAO);
    }

    @Test
    void julianaPrecisaMontarReserva() {
        List<AcaoSugerida> acoes = acoes(new Infra(Cenarios.juliana(CenarioBuilder.comInstituicoesPadrao()).build()), "cli-003");

        assertThat(acao(acoes, TipoAcao.MONTAR_RESERVA).titulo()).isEqualTo("Completar a reserva: faltam R$ 27 mil");
        assertThat(acao(acoes, TipoAcao.CONVIDAR_CONEXAO).titulo()).isEqualTo("Convidar a conectar o Banco Aurora pelo app");
    }

    @Test
    void semAlertasOConviteViraPrincipal() {
        CenarioBuilder b = CenarioBuilder.comInstituicoesPadrao();
        b.cliente("cli-x", "Fulano", "000", br.com.rotaxp.copiloto.dominio.Enums.PerfilInvestidor.MODERADO,
                List.of(CenarioBuilder.decl("inst-xp", br.com.rotaxp.copiloto.dominio.Enums.ProdutoDeclarado.INVESTIMENTOS),
                        CenarioBuilder.decl("inst-ipe", br.com.rotaxp.copiloto.dominio.Enums.ProdutoDeclarado.CONTA)),
                List.of(), List.of()).interno("cli-x");

        List<AcaoSugerida> acoes = acoes(new Infra(b.build()), "cli-x");

        assertThat(acoes).singleElement().satisfies(a -> {
            assertThat(a.tipo()).isEqualTo(TipoAcao.CONVIDAR_CONEXAO);
            assertThat(a.principal()).isTrue();
        });
    }
}
