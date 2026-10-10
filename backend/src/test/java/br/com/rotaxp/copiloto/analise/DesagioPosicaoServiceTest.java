package br.com.rotaxp.copiloto.analise;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.rotaxp.copiloto.config.DesagioProps;
import br.com.rotaxp.copiloto.config.Premissas;
import br.com.rotaxp.copiloto.demo.DataReferencia;
import br.com.rotaxp.copiloto.dominio.Cliente;
import br.com.rotaxp.copiloto.dominio.Emissor;
import br.com.rotaxp.copiloto.dominio.Enums.Indexador;
import br.com.rotaxp.copiloto.dominio.Enums.PerfilInvestidor;
import br.com.rotaxp.copiloto.dominio.Enums.Produto;
import br.com.rotaxp.copiloto.dominio.Enums.TipoEmissor;
import br.com.rotaxp.copiloto.dominio.Excecoes.NaoEncontrado;
import br.com.rotaxp.copiloto.dominio.Excecoes.RequisicaoInvalida;
import br.com.rotaxp.copiloto.dominio.Instituicao;
import br.com.rotaxp.copiloto.dominio.PosicaoInvestimento;
import br.com.rotaxp.copiloto.dominio.SimulacaoDesagio.DesagioDetalhado;
import br.com.rotaxp.copiloto.dominio.SimulacaoDesagio.DesagioPedido;
import br.com.rotaxp.copiloto.dominio.SimulacaoDesagio.PosicaoDesagio;
import br.com.rotaxp.copiloto.dominio.SimulacaoDesagio.PosicoesDesagio;
import br.com.rotaxp.copiloto.openfinance.DadosVisiveis;
import br.com.rotaxp.copiloto.openfinance.OpenFinanceGateway;
import br.com.rotaxp.copiloto.support.CenarioBuilder;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class DesagioPosicaoServiceTest {

    private static BigDecimal bd(String s) { return new BigDecimal(s); }

    private final Instituicao xp = new Instituicao("inst-xp", "XP Investimentos", "cong-xp", "XP", true);
    private final Emissor ipe = new Emissor("emi-ipe", "Banco Ipê", "cong-ipe", TipoEmissor.BANCO);

    private final PosicaoInvestimento cdb = new PosicaoInvestimento("inv-1", "cli-1", "inst-xp", "emi-ipe", Produto.CDB,
            "CDB Banco Ipê 2028", bd("139130.43"), bd("160000"), LocalDate.of(2025, 6, 18), LocalDate.of(2028, 6, 15),
            Indexador.CDI, "112% do CDI", false);
    private final PosicaoInvestimento tesouroSelic = new PosicaoInvestimento("inv-2", "cli-1", "inst-xp", "emi-tesouro",
            Produto.TESOURO, "Tesouro Selic 2029", bd("700000"), bd("800000"), LocalDate.of(2024, 4, 24),
            LocalDate.of(2029, 3, 1), Indexador.SELIC, "SELIC + 0,06% a.a.", true);
    private final PosicaoInvestimento fundo = new PosicaoInvestimento("inv-3", "cli-1", "inst-xp", null, Produto.FUNDO,
            "Fundo Alfa", bd("200000"), bd("260000"), LocalDate.of(2024, 4, 24), null, Indexador.NA, null, false);
    private final PosicaoInvestimento vencido = new PosicaoInvestimento("inv-4", "cli-1", "inst-xp", "emi-ipe", Produto.CDB,
            "CDB vencido", bd("1000"), bd("1100"), LocalDate.of(2024, 1, 1), LocalDate.of(2026, 10, 1), Indexador.PRE,
            "13,10% a.a.", false);

    private final DesagioProps props = new DesagioProps(bd("0.045"), bd("0.10"), 365,
            List.of(Produto.CDB, Produto.TESOURO, Produto.LCI, Produto.LCA));
    private final Premissas premissas = new Premissas(bd("0.10"),
            new Premissas.Fgc(bd("250000"), bd("1000000")));

    private DesagioPosicaoService service() {
        Cliente cliente = new Cliente("cli-1", "Marina Teixeira", "000", 40, "Médica", "SP", PerfilInvestidor.MODERADO,
                "ass-001", true, List.of(), List.of(), List.of());
        DadosVisiveis dados = new DadosVisiveis(cliente, List.of(), Map.of("inst-xp", xp), List.of(), List.of(), List.of(),
                List.of(), List.of(fundo, tesouroSelic, vencido, cdb), Map.of("inst-xp", xp), Map.of("emi-ipe", ipe));
        OpenFinanceGateway gateway = Mockito.mock(OpenFinanceGateway.class);
        Mockito.when(gateway.dados("cli-1")).thenReturn(dados);
        DataReferencia dataRef = new DataReferencia(CenarioBuilder.REF,
                Clock.fixed(Instant.parse("2026-10-11T12:00:00Z"), DataReferencia.ZONA));
        return new DesagioPosicaoService(gateway, dataRef, props, new InterpretadorTaxa(premissas, props), new DesagioService());
    }

    @Test
    void listaPosicoesComElegibilidadeEElegiveisPrimeiro() {
        PosicoesDesagio r = service().posicoes("cli-1");
        assertThat(r.clienteNome()).isEqualTo("Marina Teixeira");
        assertThat(r.dataReferencia()).isEqualTo(CenarioBuilder.REF);
        assertThat(r.premissas().cdiAnual()).isEqualTo(0.10);
        assertThat(r.posicoes()).extracting(PosicaoDesagio::posicaoId).startsWith("inv-1");
        assertThat(r.posicoes()).hasSize(4);

        PosicaoDesagio c = r.posicoes().get(0);
        assertThat(c.elegivel()).isTrue();
        assertThat(c.emissorNome()).isEqualTo("Banco Ipê");
        assertThat(c.instituicaoNome()).isEqualTo("XP Investimentos");
        assertThat(c.taxaAnualEstimada()).isEqualTo(0.112);
        assertThat(c.taxaDependeDePremissa()).isTrue();
        assertThat(c.prazoRestanteAnos()).isEqualTo(1.6795);
    }

    @Test
    void motivosDeInelegibilidade() {
        Map<String, PosicaoDesagio> porId = new HashMap<>();
        service().posicoes("cli-1").posicoes().forEach(p -> porId.put(p.posicaoId(), p));
        assertThat(porId.get("inv-2").motivoInelegibilidade()).contains("liquidez diária");
        assertThat(porId.get("inv-3").motivoInelegibilidade()).contains("sem marcação a mercado");
        assertThat(porId.get("inv-4").motivoInelegibilidade()).contains("vencido");
        assertThat(porId.get("inv-3").prazoRestanteAnos()).isNull();
    }

    @Test
    void simulaAPartirDaPosicaoPreenchendoValorTaxaEPrazo() {
        DesagioDetalhado r = service().simular(new DesagioPedido("cli-1", "inv-1", null, null, null, bd("0.03"), null, bd("0.135")));
        assertThat(r.entrada().posicaoNome()).isEqualTo("CDB Banco Ipê 2028");
        assertThat(r.entrada().valorAtual()).isEqualByComparingTo("160000.00");
        assertThat(r.entrada().taxaAntiga()).isEqualTo(0.112);
        assertThat(r.entrada().precoVenda()).isEqualByComparingTo("155200.00");
        assertThat(r.compensa()).isTrue();
        assertThat(r.avisos()).hasSize(1);
        assertThat(r.avisos().get(0)).contains("112% do CDI").contains("Ajuste");
    }

    @Test
    void camposInformadosSobrescrevemOsDaPosicao() {
        DesagioDetalhado r = service().simular(new DesagioPedido("cli-1", "inv-1", bd("150000"), bd("0.12"), bd("1.5"), null,
                bd("145000"), bd("0.14")));
        assertThat(r.entrada().valorAtual()).isEqualByComparingTo("150000.00");
        assertThat(r.entrada().taxaAntiga()).isEqualTo(0.12);
        assertThat(r.entrada().prazoRestanteAnos()).isEqualTo(1.5);
        assertThat(r.avisos()).isEmpty();
    }

    @Test
    void simulaManualSemPosicao() {
        DesagioDetalhado r = service().simular(new DesagioPedido(null, null, bd("100000"), bd("0.12"), bd("3"), bd("0.03"), null, bd("0.14")));
        assertThat(r.breakEvenAnos()).isEqualTo(1.72);
        assertThat(r.entrada().posicaoId()).isNull();
    }

    @Test
    void posicaoInexistenteOuInelegivel() {
        DesagioPosicaoService s = service();
        assertThatThrownBy(() -> s.simular(new DesagioPedido("cli-1", "inv-9", null, null, null, bd("0.03"), null, bd("0.14"))))
                .isInstanceOf(NaoEncontrado.class).hasMessageContaining("inv-9");
        assertThatThrownBy(() -> s.simular(new DesagioPedido("cli-1", "inv-2", null, null, null, bd("0.03"), null, bd("0.14"))))
                .isInstanceOf(RequisicaoInvalida.class).hasMessageContaining("liquidez diária");
        assertThatThrownBy(() -> s.simular(new DesagioPedido(null, "inv-1", null, null, null, bd("0.03"), null, bd("0.14"))))
                .isInstanceOf(RequisicaoInvalida.class).hasMessageContaining("clienteId");
    }

    @Test
    void validaOPedido() {
        DesagioPosicaoService s = service();
        assertThatThrownBy(() -> s.simular(new DesagioPedido(null, null, null, null, null, null, null, null)))
                .isInstanceOf(RequisicaoInvalida.class)
                .hasMessageContaining("valorAtual").hasMessageContaining("taxaAntiga").hasMessageContaining("taxaNova")
                .hasMessageContaining("prazoRestanteAnos").hasMessageContaining("exatamente um");
        assertThatThrownBy(() -> s.simular(new DesagioPedido(null, null, bd("1000"), bd("0.12"), bd("2"), bd("0.03"), bd("970"), bd("0.14"))))
                .hasMessageContaining("exatamente um");
        assertThatThrownBy(() -> s.simular(new DesagioPedido(null, null, bd("1000"), bd("0.12"), bd("2"), bd("1"), null, bd("0.14"))))
                .hasMessageContaining("desagio deve estar entre");
        assertThatThrownBy(() -> s.simular(new DesagioPedido(null, null, bd("1000"), bd("0.12"), bd("2"), null, bd("1200"), bd("0.14"))))
                .hasMessageContaining("precoVenda");
        assertThatThrownBy(() -> s.simular(new DesagioPedido(null, null, bd("1000"), bd("12"), bd("2"), bd("0.03"), null, bd("0.14"))))
                .hasMessageContaining("taxaAntiga deve estar entre");
        assertThatThrownBy(() -> s.simular(null)).isInstanceOf(RequisicaoInvalida.class);
    }
}