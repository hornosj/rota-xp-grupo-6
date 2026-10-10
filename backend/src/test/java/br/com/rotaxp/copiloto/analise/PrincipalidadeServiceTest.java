package br.com.rotaxp.copiloto.analise;

import static br.com.rotaxp.copiloto.support.CenarioBuilder.REF;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import br.com.rotaxp.copiloto.config.PrincipalidadeProps;
import br.com.rotaxp.copiloto.config.RendaProps;
import br.com.rotaxp.copiloto.dominio.Enums.Escopo;
import br.com.rotaxp.copiloto.dominio.Enums.Modalidade;
import br.com.rotaxp.copiloto.dominio.Enums.PerfilInvestidor;
import br.com.rotaxp.copiloto.dominio.Enums.PosicaoXp;
import br.com.rotaxp.copiloto.dominio.Enums.Produto;
import br.com.rotaxp.copiloto.dominio.Enums.StatusConsentimento;
import br.com.rotaxp.copiloto.dominio.Enums.TipoConta;
import br.com.rotaxp.copiloto.dominio.Enums.TipoTransacao;
import br.com.rotaxp.copiloto.dominio.Principalidade;
import br.com.rotaxp.copiloto.dominio.ScoreInstituicao;
import br.com.rotaxp.copiloto.openfinance.DadosVisiveis;
import br.com.rotaxp.copiloto.support.CenarioBuilder;
import br.com.rotaxp.copiloto.support.Cenarios;
import br.com.rotaxp.copiloto.support.Infra;
import java.util.List;
import org.junit.jupiter.api.Test;

class PrincipalidadeServiceTest {

    private final Categorizador categorizador = new Categorizador();
    private final RendaProps rendaProps = new RendaProps(3, 0.15, 6, 3);
    private final DetectorRenda detector = new DetectorRenda(categorizador, rendaProps);
    private final PrincipalidadeService service = new PrincipalidadeService(categorizador, detector, rendaProps,
            new PrincipalidadeProps(new PrincipalidadeProps.Pesos(0.30, 0.20, 0.15, 0.15, 0.10, 0.10), 40));

    private Principalidade calcular(CenarioBuilder b, String clienteId) {
        DadosVisiveis d = new Infra(b.build()).gateway.dados(clienteId);
        return service.calcular(d, REF);
    }

    private static ScoreInstituicao score(Principalidade p, String inst) {
        return p.scores().stream().filter(s -> s.instituicaoId().equals(inst)).findFirst().orElseThrow();
    }

    private static CenarioBuilder vazio(String... instsAtivas) {
        CenarioBuilder b = CenarioBuilder.comInstituicoesPadrao();
        b.cliente("cli-x", "Fulano", "000", PerfilInvestidor.MODERADO, List.of(), List.of(), List.of()).interno("cli-x");
        for (String inst : instsAtivas) {
            b.consentimento("cli-x", inst, StatusConsentimento.ATIVO, REF.plusDays(200), Escopo.values());
        }
        return b;
    }

    @Test
    void marinaTemAuroraComoPrincipalEXpSoComInvestimentos() {
        Principalidade p = calcular(Cenarios.marina(CenarioBuilder.comInstituicoesPadrao()), "cli-001");

        assertThat(p.instituicaoPrincipalId()).isEqualTo("inst-aurora");
        assertThat(p.instituicaoPrincipalNome()).isEqualTo("Banco Aurora");
        assertThat(p.posicaoXp()).isEqualTo(PosicaoXp.SO_INVESTIMENTOS);
        assertThat(score(p, "inst-aurora").score()).isEqualTo(85.0);
        assertThat(score(p, "inst-xp").score()).isEqualTo(15.0);
        assertThat(score(p, "inst-xp").contribuicoes().investimentos()).isEqualTo(15.0);
        assertThat(score(p, "inst-aurora").participacoes().renda()).isEqualTo(1.0);
        assertThat(p.scores()).extracting(ScoreInstituicao::instituicaoId).containsExactly("inst-aurora", "inst-xp");
    }

    @Test
    void destaquesEExplicacaoEmPortugues() {
        Principalidade p = calcular(Cenarios.marina(CenarioBuilder.comInstituicoesPadrao()), "cli-001");

        assertThat(score(p, "inst-aurora").destaques()).startsWith("recebe 100% da renda", "100% da movimentação");
        assertThat(score(p, "inst-xp").destaques()).containsExactly("custodia 100% dos investimentos");
        assertThat(p.explicacao()).isEqualTo("Banco Aurora é a instituição principal: recebe 100% da renda e concentra "
                + "100% dos pagamentos recorrentes. A XP tem 15 pontos: só investimentos.");
    }

    @Test
    void contribuicoesSomamOScore() {
        Principalidade p = calcular(Cenarios.marina(CenarioBuilder.comInstituicoesPadrao()), "cli-001");
        ScoreInstituicao.Componentes c = score(p, "inst-aurora").contribuicoes();

        assertThat(c.renda() + c.movimentacao() + c.contasRecorrentes() + c.investimentos() + c.cartao() + c.credito())
                .isCloseTo(85.0, within(0.01));
    }

    @Test
    void componentesZeradosSaemEOsPesosSaoRenormalizados() {
        // Só conta na XP com salário e contas: renda, movimentação e contas recorrentes → 100 pontos
        CenarioBuilder b = vazio();
        String c = b.conta("cli-x", "inst-xp", TipoConta.PAGAMENTO, 1000);
        b.mensal(c, TipoTransacao.CREDITO, Modalidade.TED, "SALARIO EMPRESA", 10000, 5, "01", "EMPRESA")
                .debitoMensal(c, "ENERGIA", 300);

        Principalidade p = calcular(b, "cli-x");

        assertThat(p.posicaoXp()).isEqualTo(PosicaoXp.PRINCIPAL);
        assertThat(score(p, "inst-xp").score()).isEqualTo(100.0);
    }

    @Test
    void xpMaiorScoreMasAbaixoDoMinimoEhSecundaria() {
        // renda na XP (0,30); movimentação na Aurora (0,20); contas no Ipê (0,15); investimentos no Horizonte (0,15)
        // total 0,80 → XP 37,5 < 40
        CenarioBuilder b = vazio("inst-aurora", "inst-ipe", "inst-horizonte");
        String xp = b.conta("cli-x", "inst-xp", TipoConta.PAGAMENTO, 0);
        String aurora = b.conta("cli-x", "inst-aurora", TipoConta.CORRENTE, 0);
        String ipe = b.conta("cli-x", "inst-ipe", TipoConta.CORRENTE, 0);
        b.mensal(xp, TipoTransacao.CREDITO, Modalidade.TED, "SALARIO EMPRESA", 10000, 5, "01", "EMPRESA")
                .debitoMensal(aurora, "COMPRA DEBITO LOJA", 1000)
                .mensal(ipe, TipoTransacao.CREDITO, Modalidade.PIX, "PIX RECEBIDO", 1, 1, "000", null)   // transferência própria
                .debitoMensal(ipe, "ENERGIA", 500)
                .posicao("cli-x", "inst-horizonte", "emi-horizonte", Produto.CDB, "CDB", 1000, null, false);

        Principalidade p = calcular(b, "cli-x");

        assertThat(score(p, "inst-xp").score()).isEqualTo(37.5);
        assertThat(p.instituicaoPrincipalId()).isEqualTo("inst-xp");
        assertThat(p.posicaoXp()).isEqualTo(PosicaoXp.SECUNDARIA);
    }

    @Test
    void soInvestimentosNaXpTemPrecedenciaSobrePrincipal() {
        // único dado visível: investimentos na XP → score 100, mas a XP não está no dia a dia do cliente
        CenarioBuilder b = vazio();
        b.posicao("cli-x", "inst-xp", "emi-tesouro", Produto.TESOURO, "Tesouro Selic", 100_000, null, true);

        Principalidade p = calcular(b, "cli-x");

        assertThat(score(p, "inst-xp").score()).isEqualTo(100.0);
        assertThat(p.posicaoXp()).isEqualTo(PosicaoXp.SO_INVESTIMENTOS);
    }

    @Test
    void xpSemNenhumaParticipacaoEhAusente() {
        CenarioBuilder b = vazio("inst-aurora");
        String aurora = b.conta("cli-x", "inst-aurora", TipoConta.CORRENTE, 0);
        b.debitoMensal(aurora, "ENERGIA", 500);

        assertThat(calcular(b, "cli-x").posicaoXp()).isEqualTo(PosicaoXp.AUSENTE);
    }

    @Test
    void aplicacaoNaXpNaoContaComoMovimentacao() {
        Principalidade p = calcular(Cenarios.juliana(CenarioBuilder.comInstituicoesPadrao()), "cli-003");

        assertThat(p.instituicaoPrincipalId()).isEqualTo("inst-ipe");
        assertThat(p.posicaoXp()).isEqualTo(PosicaoXp.SO_INVESTIMENTOS);
        assertThat(score(p, "inst-ipe").participacoes().movimentacao()).isEqualTo(1.0);
    }
}
