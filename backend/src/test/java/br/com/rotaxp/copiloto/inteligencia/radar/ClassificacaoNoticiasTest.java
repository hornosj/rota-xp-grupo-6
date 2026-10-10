package br.com.rotaxp.copiloto.inteligencia.radar;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotaxp.copiloto.dominio.Emissor;
import br.com.rotaxp.copiloto.dominio.Enums.Indexador;
import br.com.rotaxp.copiloto.dominio.Enums.Produto;
import br.com.rotaxp.copiloto.dominio.Radar.Classificacao;
import br.com.rotaxp.copiloto.dominio.Radar.DirecaoNoticia;
import br.com.rotaxp.copiloto.dominio.Radar.Noticia;
import br.com.rotaxp.copiloto.dominio.Radar.OrigemClassificacao;
import br.com.rotaxp.copiloto.support.CenarioBuilder;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class ClassificacaoNoticiasTest {

    private final ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
    private final Map<String, Emissor> emissores = CenarioBuilder.comInstituicoesPadrao().build().emissores().stream()
            .collect(Collectors.toMap(Emissor::id, Function.identity()));
    private final ClassificadorRegras regras = new ClassificadorRegras();

    private static Noticia noticia(String titulo, String resumo) {
        return new Noticia("n", "teste", titulo, resumo, null, null);
    }

    // ---------- fonte curada ----------

    @Test
    void fonteCuradaTrazVinteNoticiasComGabarito() {
        List<NoticiaColetada> noticias = new FonteCurada(mapper).coletar();

        assertThat(noticias).hasSize(20);
        assertThat(noticias).extracting(n -> n.noticia().id()).doesNotHaveDuplicates();
        assertThat(noticias).allSatisfy(n -> {
            assertThat(n.noticia().titulo()).isNotBlank();
            assertThat(n.noticia().publicadaEm()).isNotNull();
            assertThat(n.referencia()).isNotNull();
            assertThat(n.referencia().origem()).isEqualTo(OrigemClassificacao.REFERENCIA);
            assertThat(n.referencia().relevancia()).isBetween(0.0, 1.0);
            assertThat(emissores.keySet()).containsAll(n.referencia().emissores());
        });
        NoticiaColetada agro = noticias.get(0);
        assertThat(agro.noticia().id()).isEqualTo("not-001");
        assertThat(agro.referencia().produtos()).containsExactly(Produto.CRA);
        assertThat(agro.referencia().direcao()).isEqualTo(DirecaoNoticia.NEGATIVA);
    }

    // ---------- classificador por regras ----------

    @Test
    void regrasReconhecemEmissorPorNomeOuApelido() {
        Classificacao c = regras.classificar(noticia("Agro Sul adia pagamento de juros de CRA",
                "A empresa contratou assessoria de reestruturação."), emissores);

        assertThat(c.emissores()).containsExactly("emi-agrosul");
        assertThat(c.produtos()).containsExactly(Produto.CRA);
        assertThat(c.direcao()).isEqualTo(DirecaoNoticia.NEGATIVA);
        assertThat(c.origem()).isEqualTo(OrigemClassificacao.REGRAS);
        assertThat(c.relevancia()).isGreaterThanOrEqualTo(0.7);
    }

    @Test
    void regrasDistinguemBancoAuroraDaAuroraFinanceira() {
        assertThat(regras.classificar(noticia("Banco Aurora reduz tarifas", ""), emissores).emissores())
                .containsExactly("emi-aurora");
        assertThat(regras.classificar(noticia("Banco Aurora incorpora a Aurora Financeira", ""), emissores).emissores())
                .containsExactlyInAnyOrder("emi-aurora", "emi-aurora-fin");
    }

    @Test
    void regrasReconhecemIndexadoresEProdutos() {
        Classificacao c = regras.classificar(noticia("Copom eleva a Selic; juros futuros sobem",
                "Prefixados e títulos atrelados ao IPCA oscilam. Tesouro faz leilão."), emissores);

        assertThat(c.indexadores()).contains(Indexador.SELIC, Indexador.PRE, Indexador.IPCA);
        assertThat(c.produtos()).contains(Produto.TESOURO);
        assertThat(c.emissores()).isEmpty();
    }

    @Test
    void noticiaSemNadaRelevanteTemRelevanciaBaixa() {
        Classificacao c = regras.classificar(noticia("Feriado prolongado movimenta rodovias", "Trânsito intenso."), emissores);

        assertThat(c.emissores()).isEmpty();
        assertThat(c.indexadores()).isEmpty();
        assertThat(c.produtos()).isEmpty();
        assertThat(c.relevancia()).isLessThan(0.3);
    }

    // ---------- avaliação contra o gabarito ----------

    @Test
    void avaliacaoCalculaPrecisaoECoberturaPorCampo() {
        Classificacao gabarito = new Classificacao(List.of("emi-agrosul"), List.of(Indexador.IPCA), List.of(Produto.CRA),
                DirecaoNoticia.NEGATIVA, 0.9, "", OrigemClassificacao.REFERENCIA);
        Classificacao obtida = new Classificacao(List.of("emi-agrosul", "emi-ipe"), List.of(), List.of(Produto.CRA),
                DirecaoNoticia.NEGATIVA, 0.8, "", OrigemClassificacao.LLM);

        AvaliacaoClassificacao.Placar p = AvaliacaoClassificacao.avaliar(List.of(gabarito), List.of(obtida));

        assertThat(p.precisaoEmissores()).isEqualTo(0.5);
        assertThat(p.coberturaEmissores()).isEqualTo(1.0);
        assertThat(p.coberturaIndexadores()).isEqualTo(0.0);
        assertThat(p.acertoDirecao()).isEqualTo(1.0);
        assertThat(p.erroMedioRelevancia()).isEqualTo(0.1, org.assertj.core.data.Offset.offset(1e-9));
    }

    @Test
    void regrasAcertamOsEmissoresDoGabaritoCurado() {
        List<NoticiaColetada> curadas = new FonteCurada(mapper).coletar();
        List<Classificacao> obtidas = curadas.stream().map(n -> regras.classificar(n.noticia(), emissores)).toList();

        AvaliacaoClassificacao.Placar p = AvaliacaoClassificacao.avaliar(
                curadas.stream().map(NoticiaColetada::referencia).toList(), obtidas);

        assertThat(p.coberturaEmissores()).isGreaterThanOrEqualTo(0.9);
        assertThat(p.precisaoEmissores()).isGreaterThanOrEqualTo(0.9);
        assertThat(p.acertoDirecao()).isGreaterThanOrEqualTo(0.6);
    }
}
