package br.com.rotaxp.copiloto.inteligencia.radar;

import static br.com.rotaxp.copiloto.support.CenarioBuilder.REF;
import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotaxp.copiloto.dominio.Enums.Escopo;
import br.com.rotaxp.copiloto.dominio.Enums.Indexador;
import br.com.rotaxp.copiloto.dominio.Enums.PerfilInvestidor;
import br.com.rotaxp.copiloto.dominio.Enums.Produto;
import br.com.rotaxp.copiloto.dominio.Enums.StatusConsentimento;
import br.com.rotaxp.copiloto.dominio.Enums.TipoConta;
import br.com.rotaxp.copiloto.dominio.Radar.Classificacao;
import br.com.rotaxp.copiloto.dominio.Radar.DirecaoNoticia;
import br.com.rotaxp.copiloto.dominio.Radar.ImpactoNoticia;
import br.com.rotaxp.copiloto.dominio.Radar.Noticia;
import br.com.rotaxp.copiloto.dominio.Radar.NoticiaClassificada;
import br.com.rotaxp.copiloto.dominio.Radar.OrigemClassificacao;
import br.com.rotaxp.copiloto.support.CenarioBuilder;
import br.com.rotaxp.copiloto.support.Cenarios;
import br.com.rotaxp.copiloto.support.Infra;
import java.util.List;
import org.junit.jupiter.api.Test;

class CruzamentoCarteiraTest {

    private final CruzamentoCarteira cruzamento = new CruzamentoCarteira(0.25, 10);

    private static NoticiaClassificada noticia(String id, List<String> emissores, List<Indexador> ix, List<Produto> pr,
                                               DirecaoNoticia dir, double rel) {
        return new NoticiaClassificada(new Noticia(id, "Curadoria (fictícia)", "Título " + id, "", null, null),
                new Classificacao(emissores, ix, pr, dir, rel, null, OrigemClassificacao.REFERENCIA));
    }

    /** Parecido com o Roberto (cli-005): CRA Agro Sul 900k, Tesouro Selic 600k, fundo 300k, LCA Horizonte 200k, conta 25k. */
    private static Infra roberto() {
        CenarioBuilder b = CenarioBuilder.comInstituicoesPadrao();
        b.cliente("cli-005", "Roberto Lima", "555", PerfilInvestidor.MODERADO, List.of(), List.of(), List.of()).interno("cli-005")
                .consentimento("cli-005", "inst-ipe", StatusConsentimento.ATIVO, REF.plusDays(200), Escopo.values());
        b.conta("cli-005", "inst-ipe", TipoConta.CORRENTE, 25_000);
        b.posicao("cli-005", "inst-xp", "emi-agrosul", Produto.CRA, "CRA Agro Sul", 900_000, REF.plusYears(3), false)
                .posicao("cli-005", "inst-xp", "emi-tesouro", Produto.TESOURO, "Tesouro Selic", 600_000, REF.plusYears(2), true)
                .posicao("cli-005", "inst-xp", null, Produto.FUNDO, "Fundo", 300_000, null, false)
                .posicao("cli-005", "inst-xp", "emi-horizonte", Produto.LCA, "LCA Horizonte", 200_000, REF.plusYears(1), false);
        return new Infra(b.build());
    }

    @Test
    void noticiaDeEmissorCasaPelaExposicaoAoEmissor() {
        Infra i = roberto();

        List<ImpactoNoticia> r = cruzamento.impactos(i.gateway.dados("cli-005"), List.of(
                noticia("not-001", List.of("emi-agrosul"), List.of(), List.of(Produto.CRA), DirecaoNoticia.NEGATIVA, 0.9)));

        assertThat(r).singleElement().satisfies(imp -> {
            assertThat(imp.clienteId()).isEqualTo("cli-005");
            assertThat(imp.clienteNome()).isEqualTo("Roberto Lima");
            assertThat(imp.noticiaId()).isEqualTo("not-001");
            assertThat(imp.valorExposto()).isEqualByComparingTo("900000");
            assertThat(imp.fracaoPatrimonio()).isEqualTo(0.4444);
            assertThat(imp.pontos()).isEqualTo(90.0);
            assertThat(imp.direcao()).isEqualTo(DirecaoNoticia.NEGATIVA);
            assertThat(imp.motivo()).isEqualTo("R$ 900 mil em CRA da Agro Sul Sementes S.A. (44,4% do patrimônio visível)");
            assertThat(imp.gatilhos()).containsExactly("emissor: Agro Sul Sementes S.A.");
        });
    }

    @Test
    void noticiaDeEmissorNaoCasaPorProdutoDeOutroEmissor() {
        Infra i = roberto();

        // notícia sobre CRA de um emissor que o cliente não tem
        List<ImpactoNoticia> r = cruzamento.impactos(i.gateway.dados("cli-005"), List.of(
                noticia("x", List.of("emi-ipe"), List.of(), List.of(Produto.CRA), DirecaoNoticia.NEGATIVA, 0.9)));

        assertThat(r).isEmpty();
    }

    @Test
    void noticiaMacroCasaPorIndexadorEProduto() {
        Infra i = roberto();

        List<ImpactoNoticia> porProduto = cruzamento.impactos(i.gateway.dados("cli-005"), List.of(
                noticia("not-007", List.of(), List.of(), List.of(Produto.TESOURO), DirecaoNoticia.NEUTRA, 0.7)));

        assertThat(porProduto).singleElement().satisfies(imp -> {
            assertThat(imp.valorExposto()).isEqualByComparingTo("600000");
            assertThat(imp.pontos()).isEqualTo(70.0);
            assertThat(imp.gatilhos()).containsExactly("produto: TESOURO");
            assertThat(imp.motivo()).isEqualTo("R$ 600 mil em posições ligadas a Tesouro Direto (29,6% do patrimônio visível)");
        });

        // o CenarioBuilder cria todas as posições em CDI
        List<ImpactoNoticia> porIndexador = cruzamento.impactos(i.gateway.dados("cli-005"), List.of(
                noticia("not-019", List.of(), List.of(Indexador.SELIC, Indexador.CDI), List.of(), DirecaoNoticia.NEUTRA, 0.4)));

        assertThat(porIndexador.get(0).valorExposto()).isEqualByComparingTo("2000000");
        assertThat(porIndexador.get(0).gatilhos()).containsExactly("indexador: CDI");
    }

    @Test
    void conglomeradoContaParaEmissoresIrmaos() {
        CenarioBuilder b = CenarioBuilder.comInstituicoesPadrao();
        b.cliente("cli-x", "Fulano", "000", PerfilInvestidor.MODERADO, List.of(), List.of(), List.of()).interno("cli-x");
        b.posicao("cli-x", "inst-xp", "emi-aurora-fin", Produto.LCI, "LCI Aurora Financeira", 300_000, null, false)
                .posicao("cli-x", "inst-xp", "emi-tesouro", Produto.TESOURO, "Tesouro", 300_000, null, false);
        Infra i = new Infra(b.build());

        List<ImpactoNoticia> r = cruzamento.impactos(i.gateway.dados("cli-x"), List.of(
                noticia("n", List.of("emi-aurora"), List.of(), List.of(), DirecaoNoticia.NEGATIVA, 0.6)));

        assertThat(r).singleElement().satisfies(imp -> {
            assertThat(imp.valorExposto()).isEqualByComparingTo("300000");
            assertThat(imp.motivo()).startsWith("R$ 300 mil em LCI da Aurora Financeira");
        });
    }

    @Test
    void soConsideraOQueEstaVisivelPeloConsentimento() {
        Infra i = new Infra(Cenarios.marina(CenarioBuilder.comInstituicoesPadrao()).build());
        NoticiaClassificada horizonte = noticia("not-002", List.of("emi-horizonte"), List.of(), List.of(Produto.CDB),
                DirecaoNoticia.NEGATIVA, 0.8);

        assertThat(cruzamento.impactos(i.gateway.dados("cli-001"), List.of(horizonte))).isEmpty();

        i.consentimentos.conceder("cli-001", "inst-horizonte");
        List<ImpactoNoticia> depois = cruzamento.impactos(i.gateway.dados("cli-001"), List.of(horizonte));

        assertThat(depois).singleElement().satisfies(imp -> {
            assertThat(imp.valorExposto()).isEqualByComparingTo("650000");
            assertThat(imp.pontos()).isEqualTo(80.0);
        });
    }

    @Test
    void ignoraImpactoPequenoEOrdenaPorPontos() {
        Infra i = roberto();

        List<ImpactoNoticia> r = cruzamento.impactos(i.gateway.dados("cli-005"), List.of(
                noticia("pequena", List.of("emi-horizonte"), List.of(), List.of(), DirecaoNoticia.NEUTRA, 0.1),   // 0,1×100×(0,1/0,25) = 4
                noticia("media", List.of("emi-horizonte"), List.of(), List.of(), DirecaoNoticia.NEGATIVA, 0.6),   // 0,6×100×0,395 ≈ 23,7
                noticia("grande", List.of("emi-agrosul"), List.of(), List.of(), DirecaoNoticia.NEGATIVA, 0.9)));

        assertThat(r).extracting(ImpactoNoticia::noticiaId).containsExactly("grande", "media");
    }
}
