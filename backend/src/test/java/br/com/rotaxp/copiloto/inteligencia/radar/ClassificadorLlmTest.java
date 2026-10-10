package br.com.rotaxp.copiloto.inteligencia.radar;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotaxp.copiloto.agentes.AgentesTipos.ItemClassificado;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.LoteClassificado;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.LoteNoticias;
import br.com.rotaxp.copiloto.agentes.ExecutorAgentes;
import br.com.rotaxp.copiloto.dominio.Emissor;
import br.com.rotaxp.copiloto.dominio.Enums.Indexador;
import br.com.rotaxp.copiloto.dominio.Enums.Produto;
import br.com.rotaxp.copiloto.dominio.Radar.Classificacao;
import br.com.rotaxp.copiloto.dominio.Radar.DirecaoNoticia;
import br.com.rotaxp.copiloto.dominio.Radar.Noticia;
import br.com.rotaxp.copiloto.dominio.Radar.OrigemClassificacao;
import br.com.rotaxp.copiloto.support.CenarioBuilder;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class ClassificadorLlmTest {

    static final String MODELO = "openai/gpt-oss-120b";

    private final Map<String, Emissor> emissores = CenarioBuilder.comInstituicoesPadrao().build().emissores().stream()
            .collect(Collectors.toMap(Emissor::id, Function.identity()));

    /** Executor falso: responde cada lote classificando tudo como Agro Sul / IPCA, ou falha nos lotes marcados. */
    static class AgenteFalso implements ExecutorAgentes {
        final List<LoteNoticias> lotes = new ArrayList<>();
        int falharNoLote = -1;
        boolean omitirUltimo;
        Function<Noticia, ItemClassificado> resposta = n -> new ItemClassificado(n.id(), List.of("emi-agrosul", "emi-inventado"),
                List.of("IPCA", "DOLAR"), List.of("CRA"), "NEGATIVA", 1.7, "impacto");

        @Override public <T> T executar(Object entrada, Class<T> resultado) {
            LoteNoticias lote = (LoteNoticias) entrada;
            lotes.add(lote);
            if (lotes.size() - 1 == falharNoLote) throw new IllegalStateException("timeout");
            List<Noticia> ns = omitirUltimo ? lote.noticias().subList(0, lote.noticias().size() - 1) : lote.noticias();
            return resultado.cast(new LoteClassificado(ns.stream().map(resposta).toList()));
        }
    }

    private static List<Noticia> noticias(int n) {
        return IntStream.rangeClosed(1, n).mapToObj(i -> new Noticia("n" + i, "f", "Agro Sul adia juros do CRA " + i, "", null, null))
                .toList();
    }

    private ClassificadorLlm classificador(AgenteFalso agente, int tamanhoLote) {
        return new ClassificadorLlm(agente, new ClassificadorRegras(), MODELO, tamanhoLote);
    }

    @Test
    void divideEmLotesEUsaOModeloDeClassificacao() {
        AgenteFalso agente = new AgenteFalso();

        ClassificadorLlm.Resultado r = classificador(agente, 10).classificar(noticias(23), emissores);

        assertThat(agente.lotes).extracting(l -> l.noticias().size()).containsExactly(10, 10, 3);
        assertThat(agente.lotes).allMatch(l -> l.modelo().equals(MODELO));
        assertThat(agente.lotes.get(0).emissoresPermitidos()).extracting(LoteNoticias.EmissorPermitido::id).contains("emi-agrosul");
        assertThat(r.lotes()).isEqualTo(3);
        assertThat(r.porLlm()).isEqualTo(23);
        assertThat(r.porRegra()).isZero();
        assertThat(r.classificacoes()).hasSize(23);
    }

    @Test
    void validaCadaItemDaRespostaDoLlm() {
        Classificacao c = classificador(new AgenteFalso(), 10).classificar(noticias(1), emissores).classificacoes().get("n1");

        assertThat(c.origem()).isEqualTo(OrigemClassificacao.LLM);
        assertThat(c.emissores()).containsExactly("emi-agrosul");          // emissor inventado descartado
        assertThat(c.indexadores()).containsExactly(Indexador.IPCA);       // "DOLAR" não é indexador
        assertThat(c.produtos()).containsExactly(Produto.CRA);
        assertThat(c.direcao()).isEqualTo(DirecaoNoticia.NEGATIVA);
        assertThat(c.relevancia()).isEqualTo(1.0);                         // limitada a 0–1
    }

    @Test
    void itemAusenteNaRespostaCaiNasRegras() {
        AgenteFalso agente = new AgenteFalso();
        agente.omitirUltimo = true;

        ClassificadorLlm.Resultado r = classificador(agente, 10).classificar(noticias(3), emissores);

        assertThat(r.classificacoes().get("n3").origem()).isEqualTo(OrigemClassificacao.REGRAS);
        assertThat(r.porLlm()).isEqualTo(2);
        assertThat(r.porRegra()).isEqualTo(1);
    }

    @Test
    void falhaDeUmLoteCaiNasRegrasSoParaAquelasNoticias() {
        AgenteFalso agente = new AgenteFalso();
        agente.falharNoLote = 1;

        ClassificadorLlm.Resultado r = classificador(agente, 2).classificar(noticias(5), emissores);

        assertThat(r.classificacoes().get("n1").origem()).isEqualTo(OrigemClassificacao.LLM);
        assertThat(r.classificacoes().get("n3").origem()).isEqualTo(OrigemClassificacao.REGRAS);
        assertThat(r.classificacoes().get("n4").origem()).isEqualTo(OrigemClassificacao.REGRAS);
        assertThat(r.classificacoes().get("n5").origem()).isEqualTo(OrigemClassificacao.LLM);
        assertThat(r.porRegra()).isEqualTo(2);
    }

    @Test
    void direcaoInvalidaViraNeutraESemNoticiasNaoChamaOLlm() {
        AgenteFalso agente = new AgenteFalso();
        agente.resposta = n -> new ItemClassificado(n.id(), null, null, null, "talvez", -0.2, null);

        Classificacao c = classificador(agente, 10).classificar(noticias(1), emissores).classificacoes().get("n1");

        assertThat(c.direcao()).isEqualTo(DirecaoNoticia.NEUTRA);
        assertThat(c.relevancia()).isZero();
        assertThat(c.emissores()).isEmpty();

        AgenteFalso outro = new AgenteFalso();
        assertThat(classificador(outro, 10).classificar(List.of(), emissores).lotes()).isZero();
        assertThat(outro.lotes).isEmpty();
    }
}
