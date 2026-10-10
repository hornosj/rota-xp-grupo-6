package br.com.rotaxp.copiloto.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

/** AN-02: cada âncora do §6.5 contra a seed real, pela API. */
@SpringBootTest
@AutoConfigureMockMvc
class EsperadosAncorasTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Autowired MockMvc mvc;

    static JsonNode esperados() throws Exception {
        try (InputStream in = EsperadosAncorasTest.class.getResourceAsStream("/esperados.json")) {
            return MAPPER.readTree(in);
        }
    }

    static Stream<JsonNode> casos() throws Exception {
        List<JsonNode> r = new ArrayList<>();
        esperados().get("casos").forEach(r::add);
        return r.stream();
    }

    private JsonNode json(String url) throws Exception {
        return MAPPER.readTree(mvc.perform(get(url)).andReturn().getResponse().getContentAsString());
    }

    @BeforeEach
    void reset() throws Exception {
        mvc.perform(post("/api/demo/reset"));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("casos")
    void ancora(JsonNode caso) throws Exception {
        String cli = caso.get("clienteId").asText();
        if (caso.has("conceder")) {
            mvc.perform(post("/api/clientes/" + cli + "/consentimentos/" + caso.get("conceder").asText() + "/conceder"));
        }
        JsonNode v = json("/api/clientes/" + cli + "/360");
        String id = cli + " " + caso.get("momento").asText();

        assertThat(v.at("/principalidade/instituicaoPrincipalId").asText()).as(id + " principal").isEqualTo(caso.get("principal").asText());
        assertThat(v.at("/principalidade/posicaoXp").asText()).as(id + " posicaoXp").isEqualTo(caso.get("posicaoXp").asText());
        assertThat(v.at("/fluxoCaixa/custoVidaMensal").decimalValue()).as(id + " custo")
                .isEqualByComparingTo(caso.get("custoVida").decimalValue());

        List<String> tipos = new ArrayList<>();
        v.get("alertas").forEach(a -> tipos.add(a.get("tipo").asText()));
        caso.get("alertas").forEach(t -> assertThat(tipos).as(id + " alertas").contains(t.asText()));
        caso.get("alertasAusentes").forEach(t -> assertThat(tipos).as(id + " ausentes").doesNotContain(t.asText()));
        caso.get("valores").fields().forEachRemaining(e -> {
            JsonNode alerta = alerta(v, e.getKey());
            assertThat(alerta.get("valor").decimalValue()).as(id + " valor " + e.getKey()).isEqualByComparingTo(e.getValue().decimalValue());
        });
        if (caso.has("severidades")) {
            caso.get("severidades").fields().forEachRemaining(e ->
                    assertThat(alerta(v, e.getKey()).get("severidade").asText()).as(id + " severidade").isEqualTo(e.getValue().asText()));
        }

        assertThat(json("/api/clientes/" + cli + "/jornada").at("/nivel/numero").asInt()).as(id + " nível").isEqualTo(caso.get("nivel").asInt());

        if (caso.has("prioridade")) {
            JsonNode item = itemFila(cli);
            assertThat(item.get("prioridade").asDouble()).as(id + " prioridade").isEqualTo(caso.get("prioridade").asDouble());
        }
    }

    private static JsonNode alerta(JsonNode v, String tipo) {
        for (JsonNode a : v.get("alertas")) if (a.get("tipo").asText().equals(tipo)) return a;
        throw new AssertionError("alerta " + tipo + " não encontrado");
    }

    private JsonNode itemFila(String cli) throws Exception {
        for (JsonNode i : json("/api/assessor/fila")) if (i.get("clienteId").asText().equals(cli)) return i;
        throw new AssertionError(cli + " fora da fila");
    }

    @Test
    void filaAntesBateComOPlanoEFundoNaoRoubaAFila() throws Exception {
        JsonNode fila = json("/api/assessor/fila");
        JsonNode esperada = esperados().get("filaAntes");

        for (int i = 0; i < esperada.size(); i++) {
            assertThat(fila.get(i).get("clienteId").asText()).as("posição " + (i + 1)).isEqualTo(esperada.get(i).asText());
        }
        double maxFundo = 0;
        for (JsonNode item : fila) {
            if (item.get("clienteId").asText().startsWith("cli-1")) maxFundo = Math.max(maxFundo, item.get("prioridade").asDouble());
        }
        assertThat(maxFundo).isLessThanOrEqualTo(esperados().get("prioridadeMaximaFundo").asDouble());
        assertThat(fila).hasSize(36);
    }

    @Test
    void marinaNaoEhPrimeiraAntesEEhPrimeiraDepois() throws Exception {
        assertThat(json("/api/assessor/fila").get(0).get("clienteId").asText()).isNotEqualTo("cli-001");

        mvc.perform(post("/api/clientes/cli-001/consentimentos/inst-horizonte/conceder"));

        JsonNode primeiro = json("/api/assessor/fila").get(0);
        assertThat(primeiro.get("clienteId").asText()).isEqualTo("cli-001");
        assertThat(primeiro.get("novo").asBoolean()).isTrue();
        assertThat(primeiro.at("/acaoPrincipal/tipo").asText()).isEqualTo("DIVERSIFICAR_FGC");
    }
}
