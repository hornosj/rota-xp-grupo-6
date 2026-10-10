package br.com.rotaxp.copiloto.analise;

import static br.com.rotaxp.copiloto.support.CenarioBuilder.REF;
import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotaxp.copiloto.config.Premissas;
import br.com.rotaxp.copiloto.dominio.Enums.Escopo;
import br.com.rotaxp.copiloto.dominio.Enums.PerfilInvestidor;
import br.com.rotaxp.copiloto.dominio.Enums.Produto;
import br.com.rotaxp.copiloto.dominio.Enums.StatusConsentimento;
import br.com.rotaxp.copiloto.dominio.Enums.TipoConta;
import br.com.rotaxp.copiloto.support.CenarioBuilder;
import br.com.rotaxp.copiloto.support.Cenarios;
import br.com.rotaxp.copiloto.support.Infra;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class FgcServiceTest {

    private final FgcService service = new FgcService(
            new Premissas(new BigDecimal("0.10"), new Premissas.Fgc(new BigDecimal("250000"), new BigDecimal("1000000"))));

    private static CenarioBuilder cliente(String... ativas) {
        CenarioBuilder b = CenarioBuilder.comInstituicoesPadrao();
        b.cliente("cli-x", "Fulano", "000", PerfilInvestidor.MODERADO, List.of(), List.of(), List.of()).interno("cli-x");
        for (String inst : ativas) b.consentimento("cli-x", inst, StatusConsentimento.ATIVO, REF.plusDays(200), Escopo.values());
        return b;
    }

    private AnaliseFgc calcular(CenarioBuilder b, String clienteId) {
        return service.calcular(new Infra(b.build()).gateway.dados(clienteId));
    }

    private static AnaliseFgc.Conglomerado cong(AnaliseFgc a, String id) {
        return a.conglomerados().stream().filter(c -> c.conglomeradoId().equals(id)).findFirst().orElseThrow();
    }

    @Test
    void marinaAntesNaoTemExcessoEOEmissorEhQuemConta() {
        AnaliseFgc a = calcular(Cenarios.marina(CenarioBuilder.comInstituicoesPadrao()), "cli-001");

        // CDBs do Ipê custodiados na XP contam para o Ipê
        assertThat(cong(a, "cong-ipe").elegivel()).isEqualByComparingTo("230000");
        assertThat(cong(a, "cong-aurora").elegivel()).isEqualByComparingTo("85000");
        assertThat(a.conglomerados()).allMatch(c -> c.excessoFgc().signum() == 0);
        assertThat(a.totalElegivel()).isEqualByComparingTo("315000");
        assertThat(a.excedeTetoGlobal()).isFalse();
    }

    @Test
    void marinaDepoisTem400MilAcimaDaCoberturaNoHorizonte() {
        CenarioBuilder b = Cenarios.marina(CenarioBuilder.comInstituicoesPadrao());
        Infra i = new Infra(b.build());
        i.consentimentos.conceder("cli-001", "inst-horizonte");

        AnaliseFgc a = service.calcular(i.gateway.dados("cli-001"));

        AnaliseFgc.Conglomerado h = cong(a, "cong-horizonte");
        assertThat(h.excessoFgc()).isEqualByComparingTo("400000");
        assertThat(h.nome()).isEqualTo("Banco Horizonte");
        assertThat(h.referencia()).isEqualTo("do Banco Horizonte");
        assertThat(h.produtos()).containsExactly("CDB");
        assertThat(h.exposicaoSemGarantia()).isEqualByComparingTo("400000");
        assertThat(a.patrimonioVisivel()).isEqualByComparingTo("1635000");
        assertThat(h.fracaoPatrimonio()).isEqualTo(0.2446);
        assertThat(a.totalElegivel()).isEqualByComparingTo("965000");
        assertThat(a.excedeTetoGlobal()).isFalse();
    }

    @Test
    void mesmoConglomeradoSomaInstituicoesDiferentes() {
        // Patrícia: conta Aurora 6k + poupança Aurora 150k + LCI Aurora Financeira 174k = 330k → excesso 80k
        CenarioBuilder b = cliente("inst-aurora", "inst-aurora-fin");
        b.conta("cli-x", "inst-aurora", TipoConta.CORRENTE, 6_000);
        b.posicao("cli-x", "inst-aurora", "emi-aurora", Produto.POUPANCA, "Poupança", 150_000, null, true)
                .posicao("cli-x", "inst-aurora-fin", "emi-aurora-fin", Produto.LCI, "LCI", 174_000, null, false)
                .posicao("cli-x", "inst-xp", "emi-tesouro", Produto.TESOURO, "Tesouro Selic", 400_000, null, true);

        AnaliseFgc a = calcular(b, "cli-x");

        assertThat(cong(a, "cong-aurora").elegivel()).isEqualByComparingTo("330000");
        assertThat(cong(a, "cong-aurora").excessoFgc()).isEqualByComparingTo("80000");
        assertThat(cong(a, "cong-aurora").fracaoPatrimonio()).isEqualTo(0.1096);
        assertThat(cong(a, "cong-aurora").referencia()).isEqualTo("do conglomerado Aurora (Aurora Financeira e Banco Aurora)");
        assertThat(cong(a, "cong-aurora").produtos()).containsExactly("conta corrente", "LCI", "poupança");
    }

    @Test
    void contaDePagamentoEProdutosSemFgcNaoEntram() {
        CenarioBuilder b = cliente();
        b.conta("cli-x", "inst-xp", TipoConta.PAGAMENTO, 300_000);
        b.posicao("cli-x", "inst-xp", "emi-tesouro", Produto.TESOURO, "Tesouro", 500_000, null, true)
                .posicao("cli-x", "inst-xp", null, Produto.FUNDO, "Fundo", 500_000, null, false);

        AnaliseFgc a = calcular(b, "cli-x");

        assertThat(a.totalElegivel()).isEqualByComparingTo("0");
        assertThat(a.conglomerados()).allMatch(c -> c.excessoFgc().signum() == 0);
    }

    @Test
    void creditoPrivadoDeEmpresaEhExposicaoSemGarantia() {
        // Roberto: CRA Agro Sul 900k sobre patrimônio visível 2.025.000 → 44,4%, emissor EMPRESA
        CenarioBuilder b = cliente("inst-ipe");
        b.conta("cli-x", "inst-ipe", TipoConta.CORRENTE, 25_000);
        b.posicao("cli-x", "inst-xp", "emi-agrosul", Produto.CRA, "CRA Agro Sul", 900_000, null, false)
                .posicao("cli-x", "inst-xp", "emi-tesouro", Produto.TESOURO, "Tesouro Selic", 600_000, null, true)
                .posicao("cli-x", "inst-xp", null, Produto.FUNDO, "Fundo", 300_000, null, false)
                .posicao("cli-x", "inst-xp", "emi-horizonte", Produto.LCA, "LCA Horizonte", 200_000, null, false);

        AnaliseFgc.Conglomerado agro = cong(calcular(b, "cli-x"), "cong-agrosul");

        assertThat(agro.exposicaoSemGarantia()).isEqualByComparingTo("900000");
        assertThat(agro.fracaoPatrimonio()).isEqualTo(0.4444);
        assertThat(agro.emissorEmpresa()).isTrue();
        assertThat(agro.nome()).isEqualTo("Agro Sul Sementes S.A.");
        assertThat(agro.referencia()).isEqualTo("da Agro Sul Sementes S.A.");
        assertThat(agro.produtos()).containsExactly("CRA");
    }

    @Test
    void somaElegivelAcimaDeUmMilhaoExcedeTetoGlobal() {
        CenarioBuilder b = cliente();
        b.posicao("cli-x", "inst-xp", "emi-ipe", Produto.CDB, "CDB Ipê", 250_000, null, false)
                .posicao("cli-x", "inst-xp", "emi-aurora", Produto.CDB, "CDB Aurora", 250_000, null, false)
                .posicao("cli-x", "inst-xp", "emi-horizonte", Produto.CDB, "CDB Horizonte", 250_000, null, false)
                .posicao("cli-x", "inst-xp", "emi-xp", Produto.CDB, "CDB XP", 250_001, null, false);

        assertThat(calcular(b, "cli-x").excedeTetoGlobal()).isTrue();
    }
}
