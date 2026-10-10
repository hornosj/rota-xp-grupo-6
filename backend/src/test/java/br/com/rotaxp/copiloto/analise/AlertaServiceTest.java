package br.com.rotaxp.copiloto.analise;

import static br.com.rotaxp.copiloto.support.CenarioBuilder.REF;
import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotaxp.copiloto.config.AlertasProps;
import br.com.rotaxp.copiloto.config.Premissas;
import br.com.rotaxp.copiloto.config.RendaProps;
import br.com.rotaxp.copiloto.dominio.Alerta;
import br.com.rotaxp.copiloto.dominio.Cliente.Dependente;
import br.com.rotaxp.copiloto.dominio.Enums.Escopo;
import br.com.rotaxp.copiloto.dominio.Enums.Modalidade;
import br.com.rotaxp.copiloto.dominio.Enums.OrigemEvento;
import br.com.rotaxp.copiloto.dominio.Enums.PerfilInvestidor;
import br.com.rotaxp.copiloto.dominio.Enums.Produto;
import br.com.rotaxp.copiloto.dominio.Enums.Severidade;
import br.com.rotaxp.copiloto.dominio.Enums.StatusConsentimento;
import br.com.rotaxp.copiloto.dominio.Enums.TipoAlerta;
import br.com.rotaxp.copiloto.dominio.Enums.TipoConta;
import br.com.rotaxp.copiloto.dominio.Enums.TipoEventoVida;
import br.com.rotaxp.copiloto.dominio.Enums.TipoTransacao;
import br.com.rotaxp.copiloto.dominio.EventoVida;
import br.com.rotaxp.copiloto.openfinance.DadosVisiveis;
import br.com.rotaxp.copiloto.support.CenarioBuilder;
import br.com.rotaxp.copiloto.support.Cenarios;
import br.com.rotaxp.copiloto.support.Infra;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class AlertaServiceTest {

    private final RendaProps rendaProps = new RendaProps(3, 0.15, 6, 3);
    private final Categorizador categorizador = new Categorizador();
    private final FluxoCaixaService fluxoService =
            new FluxoCaixaService(categorizador, new DetectorRenda(categorizador, rendaProps), rendaProps);
    private final Premissas premissas =
            new Premissas(new BigDecimal("0.10"), new Premissas.Fgc(new BigDecimal("250000"), new BigDecimal("1000000")));
    private final FgcService fgcService = new FgcService(premissas);
    private final AlertaService service = new AlertaService(new AlertasProps(
            BigDecimal.ONE, new BigDecimal("10000"), new BigDecimal("2000"), 0.20, 0.35, 30, 15, 7, 6, new BigDecimal("0.5")),
            premissas);

    private List<Alerta> detectar(Infra i, String clienteId) {
        DadosVisiveis d = i.gateway.dados(clienteId);
        return service.detectar(d, REF, fluxoService.calcular(d, REF), fgcService.calcular(d));
    }

    private List<Alerta> detectar(CenarioBuilder b, String clienteId) {
        return detectar(new Infra(b.build()), clienteId);
    }

    private static Alerta alerta(List<Alerta> alertas, TipoAlerta tipo) {
        return alertas.stream().filter(a -> a.tipo() == tipo).findFirst().orElseThrow();
    }

    /** Cliente com custo de 5 mil/mês, liquidez folgada e sem nenhum alerta. */
    private static CenarioBuilder clienteTranquilo() {
        CenarioBuilder b = CenarioBuilder.comInstituicoesPadrao();
        b.cliente("cli-x", "Fulano de Tal", "000", PerfilInvestidor.MODERADO, List.of(), List.of(), List.of()).interno("cli-x");
        String c = b.conta("cli-x", "inst-xp", TipoConta.PAGAMENTO, 5_000);
        b.mensal(c, TipoTransacao.CREDITO, Modalidade.TED, "SALARIO EMPRESA", 6_000, 5, "01", "EMPRESA")
                .debitoMensal(c, "COMPRA DEBITO MERCADO", 5_000)
                .posicao("cli-x", "inst-xp", "emi-tesouro", Produto.TESOURO, "Tesouro Selic", 100_000, null, true);
        return b;
    }

    @Test
    void clienteTranquiloNaoTemAlertas() {
        assertThat(detectar(clienteTranquilo(), "cli-x")).isEmpty();
    }

    @Test
    void marinaAntesDoConsentimento() {
        List<Alerta> alertas = detectar(Cenarios.marina(CenarioBuilder.comInstituicoesPadrao()), "cli-001");

        assertThat(alertas).extracting(Alerta::tipo).containsExactlyInAnyOrder(
                TipoAlerta.SALDO_PARADO, TipoAlerta.RENDA_FORA_XP, TipoAlerta.EVENTO_VIDA_PROXIMO);
        Alerta saldo = alerta(alertas, TipoAlerta.SALDO_PARADO);
        assertThat(saldo.valor()).isEqualByComparingTo("61000");
        assertThat(saldo.severidade()).isEqualTo(Severidade.MEDIA);
        assertThat(saldo.titulo()).isEqualTo("R$ 61 mil parados em conta");
        assertThat(saldo.explicacao()).contains("R$ 486 por mês");
        Alerta renda = alerta(alertas, TipoAlerta.RENDA_FORA_XP);
        assertThat(renda.severidade()).isEqualTo(Severidade.BAIXA);
        assertThat(renda.instituicaoId()).isEqualTo("inst-aurora");
        assertThat(renda.valor()).isEqualByComparingTo("14000");
        assertThat(alerta(alertas, TipoAlerta.EVENTO_VIDA_PROXIMO).titulo()).isEqualTo("Aniversário da Sofia em 5 dias");
    }

    @Test
    void marinaDepoisDoConsentimentoGanhaFgcEExposicao() {
        Infra i = new Infra(Cenarios.marina(CenarioBuilder.comInstituicoesPadrao()).build());
        i.consentimentos.conceder("cli-001", "inst-horizonte");

        List<Alerta> alertas = detectar(i, "cli-001");

        Alerta fgc = alerta(alertas, TipoAlerta.FGC_EXCEDIDO);
        assertThat(fgc.severidade()).isEqualTo(Severidade.ALTA);
        assertThat(fgc.valor()).isEqualByComparingTo("400000");
        assertThat(fgc.instituicaoId()).isEqualTo("inst-horizonte");
        assertThat(fgc.emissorId()).isEqualTo("emi-horizonte");
        assertThat(fgc.explicacao()).isEqualTo("R$ 650 mil em CDB do Banco Horizonte. O FGC cobre até R$ 250 mil por CPF "
                + "por conglomerado: R$ 400 mil ficariam sem garantia se o banco quebrar.");
        Alerta conc = alerta(alertas, TipoAlerta.CONCENTRACAO_EMISSOR);
        assertThat(conc.severidade()).isEqualTo(Severidade.MEDIA);
        assertThat(conc.explicacao()).contains("24,5%");
        assertThat(alertas).extracting(Alerta::tipo).doesNotContain(TipoAlerta.FGC_TETO_GLOBAL, TipoAlerta.RESERVA_INSUFICIENTE);
        assertThat(alertas.get(0).severidade()).isEqualTo(Severidade.ALTA);
    }

    @Test
    void julianaTemReservaInsuficiente() {
        List<Alerta> alertas = detectar(Cenarios.juliana(CenarioBuilder.comInstituicoesPadrao()), "cli-003");

        assertThat(alertas).extracting(Alerta::tipo).containsExactlyInAnyOrder(
                TipoAlerta.SALDO_PARADO, TipoAlerta.RENDA_FORA_XP, TipoAlerta.RESERVA_INSUFICIENTE);
        assertThat(alerta(alertas, TipoAlerta.SALDO_PARADO).valor()).isEqualByComparingTo("13000");
        Alerta reserva = alerta(alertas, TipoAlerta.RESERVA_INSUFICIENTE);
        assertThat(reserva.valor()).isEqualByComparingTo("27000");   // falta para 6 meses
        assertThat(reserva.titulo()).isEqualTo("Reserva de emergência cobre 3 meses");
    }

    @Test
    void vencimentoEmAte30Dias() {
        CenarioBuilder b = clienteTranquilo();
        b.posicao("cli-x", "inst-xp", "emi-ipe", Produto.CDB, "CDB Banco Ipê", 240_000, REF.plusDays(20), false)
                .posicao("cli-x", "inst-xp", "emi-ipe", Produto.LCA, "LCA Banco Ipê", 10_000, REF.plusDays(31), false);

        List<Alerta> alertas = detectar(b, "cli-x");

        assertThat(alertas).extracting(Alerta::tipo).containsExactly(TipoAlerta.VENCIMENTO_PROXIMO);
        assertThat(alertas.get(0).valor()).isEqualByComparingTo("240000");
        assertThat(alertas.get(0).titulo()).isEqualTo("R$ 240 mil vencem em 20 dias");
        assertThat(alertas.get(0).emissorId()).isEqualTo("emi-ipe");
    }

    @Test
    void consentimentoExpirandoEmAte15Dias() {
        CenarioBuilder b = clienteTranquilo();
        b.consentimento("cli-x", "inst-aurora", StatusConsentimento.ATIVO, REF.plusDays(10), Escopo.CONTAS)
                .consentimento("cli-x", "inst-ipe", StatusConsentimento.ATIVO, REF.plusDays(16), Escopo.CONTAS);

        List<Alerta> alertas = detectar(b, "cli-x");

        assertThat(alertas).extracting(Alerta::tipo).containsExactly(TipoAlerta.CONSENTIMENTO_EXPIRANDO);
        assertThat(alertas.get(0).instituicaoId()).isEqualTo("inst-aurora");
        assertThat(alertas.get(0).titulo()).isEqualTo("Open Finance com o Banco Aurora expira em 10 dias");
    }

    @Test
    void creditoPrivadoDeEmpresaAcimaDe20PorCentoEhAlta() {
        CenarioBuilder b = clienteTranquilo();
        b.posicao("cli-x", "inst-xp", "emi-agrosul", Produto.CRA, "CRA Agro Sul", 50_000, null, false);   // 50/155 = 32%

        Alerta a = alerta(detectar(b, "cli-x"), TipoAlerta.CONCENTRACAO_EMISSOR);

        assertThat(a.severidade()).isEqualTo(Severidade.ALTA);
        assertThat(a.emissorId()).isEqualTo("emi-agrosul");
        assertThat(a.titulo()).isEqualTo("32,3% do patrimônio sem garantia da Agro Sul Sementes S.A.");
    }

    @Test
    void tetoGlobalDoFgc() {
        CenarioBuilder b = clienteTranquilo();
        b.posicao("cli-x", "inst-xp", "emi-ipe", Produto.CDB, "CDB Ipê", 240_000, null, false)
                .posicao("cli-x", "inst-xp", "emi-aurora", Produto.CDB, "CDB Aurora", 240_000, null, false)
                .posicao("cli-x", "inst-xp", "emi-horizonte", Produto.CDB, "CDB Horizonte", 240_000, null, false)
                .posicao("cli-x", "inst-xp", "emi-xp", Produto.CDB, "CDB XP", 240_000, null, false)
                .posicao("cli-x", "inst-aurora-fin", "emi-aurora-fin", Produto.CDB, "CDB Aurora Fin", 1, null, false);
        b.posicao("cli-x", "inst-xp", "emi-xp", Produto.LCI, "LCI XP", 5_000, null, false);   // 965.000 + 5.000... ainda ≤ 1M

        assertThat(detectar(b, "cli-x")).extracting(Alerta::tipo).doesNotContain(TipoAlerta.FGC_TETO_GLOBAL);

        b.posicao("cli-x", "inst-xp", "emi-tesouro", Produto.CDB, "CDB extra", 50_000, null, false);
        Alerta teto = alerta(detectar(b, "cli-x"), TipoAlerta.FGC_TETO_GLOBAL);
        assertThat(teto.severidade()).isEqualTo(Severidade.MEDIA);
    }

    @Test
    void rendaForaDaXpSoComCapacidadeDeAporteMinima() {
        CenarioBuilder b = CenarioBuilder.comInstituicoesPadrao();
        b.cliente("cli-x", "Fulano", "000", PerfilInvestidor.MODERADO, List.of(), List.of(), List.of()).interno("cli-x")
                .consentimento("cli-x", "inst-ipe", StatusConsentimento.ATIVO, REF.plusDays(200), Escopo.CONTAS);
        String c = b.conta("cli-x", "inst-ipe", TipoConta.CORRENTE, 1_000);
        b.mensal(c, TipoTransacao.CREDITO, Modalidade.TED, "SALARIO EMPRESA", 6_000, 5, "01", "EMPRESA")
                .debitoMensal(c, "COMPRA DEBITO MERCADO", 4_500)
                .posicao("cli-x", "inst-xp", "emi-tesouro", Produto.TESOURO, "Tesouro Selic", 100_000, null, true);

        assertThat(detectar(b, "cli-x")).extracting(Alerta::tipo).doesNotContain(TipoAlerta.RENDA_FORA_XP);
    }

    @Test
    void eventoDeVidaEmAteSeteDias() {
        CenarioBuilder b = CenarioBuilder.comInstituicoesPadrao();
        b.cliente("cli-x", "Fulano", "000", PerfilInvestidor.MODERADO, List.of(),
                List.of(new Dependente("Pedro", "FILHO", REF.plusDays(8).minusYears(10))),
                List.of(new EventoVida("evt-1", TipoEventoVida.CASAMENTO, "Casamento da Ana", REF.plusDays(7), OrigemEvento.CADASTRO)))
                .interno("cli-x");

        List<Alerta> alertas = detectar(b, "cli-x");

        assertThat(alertas).extracting(Alerta::titulo).containsExactly("Casamento da Ana em 7 dias");
    }

    @Test
    void idsSaoDeterministicosEUnicos() {
        Infra i = new Infra(Cenarios.marina(CenarioBuilder.comInstituicoesPadrao()).build());
        i.consentimentos.conceder("cli-001", "inst-horizonte");

        List<Alerta> a1 = detectar(i, "cli-001");
        List<Alerta> a2 = detectar(i, "cli-001");

        assertThat(a1).extracting(Alerta::id).doesNotHaveDuplicates().isEqualTo(a2.stream().map(Alerta::id).toList());
        assertThat(alerta(a1, TipoAlerta.FGC_EXCEDIDO).id()).isEqualTo("alr-cli-001-fgc_excedido-cong-horizonte");
    }
}
