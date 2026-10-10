package br.com.rotaxp.copiloto.analise;

import static br.com.rotaxp.copiloto.support.CenarioBuilder.REF;
import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotaxp.copiloto.config.RendaProps;
import br.com.rotaxp.copiloto.dominio.Enums.PerfilInvestidor;
import br.com.rotaxp.copiloto.dominio.FluxoCaixa;
import br.com.rotaxp.copiloto.support.CenarioBuilder;
import br.com.rotaxp.copiloto.support.Cenarios;
import br.com.rotaxp.copiloto.support.Infra;
import java.util.List;
import org.junit.jupiter.api.Test;

class FluxoCaixaServiceTest {

    private final Categorizador categorizador = new Categorizador();
    private final RendaProps rendaProps = new RendaProps(3, 0.15, 6, 3);
    private final FluxoCaixaService service =
            new FluxoCaixaService(categorizador, new DetectorRenda(categorizador, rendaProps), rendaProps);

    @Test
    void marina() {
        Infra i = new Infra(Cenarios.marina(CenarioBuilder.comInstituicoesPadrao()).build());

        AnaliseFluxo a = service.calcular(i.gateway.dados("cli-001"), REF);
        FluxoCaixa f = a.fluxo();

        assertThat(f.rendaMensal()).isEqualByComparingTo("38000");
        assertThat(f.custoVidaMensal()).isEqualByComparingTo("24000");
        assertThat(f.capacidadeAporteMensal()).isEqualByComparingTo("14000");
        assertThat(f.liquidezImediata()).isEqualByComparingTo("155000");   // 85 mil em conta + 70 mil CDB liquidez diária
        assertThat(f.reservaEmergenciaMeses()).isEqualTo(6.5);
        assertThat(f.parcial()).isFalse();
        assertThat(a.saldoContas()).isEqualByComparingTo("85000");
    }

    @Test
    void custoPorCategoriaDaMarina() {
        Infra i = new Infra(Cenarios.marina(CenarioBuilder.comInstituicoesPadrao()).build());

        AnaliseFluxo a = service.calcular(i.gateway.dados("cli-001"), REF);

        assertThat(a.custoPorCategoria()).containsOnlyKeys("CONTAS_RECORRENTES", "PARCELAS", "CONSUMO", "CARTOES");
        assertThat(a.custoPorCategoria().get("CONTAS_RECORRENTES")).isEqualByComparingTo("6600");
        assertThat(a.custoPorCategoria().get("PARCELAS")).isEqualByComparingTo("6500");
        assertThat(a.custoPorCategoria().get("CONSUMO")).isEqualByComparingTo("1900");
        assertThat(a.custoPorCategoria().get("CARTOES")).isEqualByComparingTo("9000");
    }

    @Test
    void julianaUsaPagamentoDaFaturaComoProxyQuandoOCartaoNaoEstaVisivel() {
        Infra i = new Infra(Cenarios.juliana(CenarioBuilder.comInstituicoesPadrao()).build());

        FluxoCaixa f = service.calcular(i.gateway.dados("cli-003"), REF).fluxo();

        assertThat(f.custoVidaMensal()).isEqualByComparingTo("9000");
        assertThat(f.parcial()).isTrue();
        assertThat(f.observacao()).contains("Banco Aurora");
        assertThat(f.liquidezImediata()).isEqualByComparingTo("27000");
        assertThat(f.reservaEmergenciaMeses()).isEqualTo(3.0);
    }

    @Test
    void julianaDepoisDeConectarOCartaoUsaAsFaturasSemContarDuasVezes() {
        Infra i = new Infra(Cenarios.juliana(CenarioBuilder.comInstituicoesPadrao()).build());
        i.consentimentos.conceder("cli-003", "inst-aurora");

        FluxoCaixa f = service.calcular(i.gateway.dados("cli-003"), REF).fluxo();

        assertThat(f.custoVidaMensal()).isEqualByComparingTo("9000");
        assertThat(f.parcial()).isFalse();
    }

    @Test
    void semGastosVisiveisNaoDividePorZero() {
        CenarioBuilder b = CenarioBuilder.comInstituicoesPadrao();
        b.cliente("cli-x", "Fulano", "000", PerfilInvestidor.MODERADO, List.of(), List.of(), List.of()).interno("cli-x");
        Infra i = new Infra(b.build());

        FluxoCaixa f = service.calcular(i.gateway.dados("cli-x"), REF).fluxo();

        assertThat(f.custoVidaMensal()).isEqualByComparingTo("0");
        assertThat(f.reservaEmergenciaMeses()).isEqualTo(0.0);
        assertThat(f.parcial()).isTrue();
    }
}
