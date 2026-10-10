package br.com.rotaxp.copiloto.inteligencia.radar;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotaxp.copiloto.agentes.ExecutorAgentes;
import br.com.rotaxp.copiloto.dominio.Radar.Classificacao;
import br.com.rotaxp.copiloto.openfinance.Repositorio;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * Compara modelos baratos na classificação do radar contra o gabarito curado (20 notícias, lotes de 10).
 * Opt-in e pago (centavos):
 *   ./mvnw test -Dtest=AvaliacaoModelosRadarTest -Dradar.avaliar-modelos=true
 * Precisa de OPENROUTER_APIKEY (chave de API comum). Os candidatos são registrados no Embabel abaixo.
 */
@SpringBootTest(properties = {
        "radar.processar-no-inicio=false",
        "embabel.agent.platform.models.openai.custom.models=" + AvaliacaoModelosRadarTest.CANDIDATOS})
@EnabledIfSystemProperty(named = "radar.avaliar-modelos", matches = "true")
@EnabledIfEnvironmentVariable(named = "OPENROUTER_APIKEY", matches = ".+")
class AvaliacaoModelosRadarTest {

    static final String CANDIDATOS = "openai/gpt-oss-120b,openai/gpt-oss-20b,mistralai/mistral-nemo,"
            + "google/gemini-2.5-flash-lite,deepseek/deepseek-v4-flash,deepseek/deepseek-v4-pro";

    @Autowired ExecutorAgentes agentes;
    @Autowired Repositorio repo;
    @Autowired ObjectMapper mapper;

    record Linha(String modelo, AvaliacaoClassificacao.Placar placar, int falhas, long ms) {}

    @Test
    void comparaModelosNoGabaritoCurado() {
        List<NoticiaColetada> curadas = new FonteCurada(mapper).coletar();
        List<Classificacao> gabarito = curadas.stream().map(NoticiaColetada::referencia).toList();
        List<Linha> linhas = new ArrayList<>();

        // linha de base sem LLM
        ClassificadorRegras regras = new ClassificadorRegras();
        linhas.add(new Linha("(regras, sem LLM)", AvaliacaoClassificacao.avaliar(gabarito,
                curadas.stream().map(n -> regras.classificar(n.noticia(), repo.emissores())).toList()), 0, 0));

        for (String modelo : CANDIDATOS.split(",")) {
            long t0 = System.currentTimeMillis();
            ClassificadorLlm.Resultado r = new ClassificadorLlm(agentes, regras, modelo, 10)
                    .classificar(curadas.stream().map(NoticiaColetada::noticia).toList(), repo.emissores());
            List<Classificacao> obtidas = curadas.stream().map(n -> r.classificacoes().get(n.noticia().id())).toList();
            linhas.add(new Linha(modelo, AvaliacaoClassificacao.avaliar(gabarito, obtidas), r.porRegra(), System.currentTimeMillis() - t0));
        }

        System.out.println("\nmodelo                          | emissores P/C | indexadores P/C | produtos P/C | direção | erro relev. | falhas | ms");
        for (Linha l : linhas) {
            var p = l.placar();
            System.out.printf("%-31s | %.2f / %.2f   | %.2f / %.2f     | %.2f / %.2f  | %.2f    | %.2f        | %6d | %d%n",
                    l.modelo(), p.precisaoEmissores(), p.coberturaEmissores(), p.precisaoIndexadores(), p.coberturaIndexadores(),
                    p.precisaoProdutos(), p.coberturaProdutos(), p.acertoDirecao(), p.erroMedioRelevancia(), l.falhas(), l.ms());
        }
        assertThat(linhas).hasSize(CANDIDATOS.split(",").length + 1);
    }
}
