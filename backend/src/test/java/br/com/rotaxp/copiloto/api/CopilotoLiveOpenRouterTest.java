package br.com.rotaxp.copiloto.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Chamada real aos agentes Embabel via OpenRouter. Opt-in: precisa de OPENROUTER_APIKEY (chave de API
 * comum, não de gerenciamento) e de -Dcopiloto.teste-live=true. Custa frações de centavo com o modelo padrão.
 * ./mvnw test -Dtest=CopilotoLiveOpenRouterTest -Dcopiloto.teste-live=true
 */
@SpringBootTest(properties = "copiloto.modo=live")
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "OPENROUTER_APIKEY", matches = ".+")
@EnabledIfSystemProperty(named = "copiloto.teste-live", matches = "true")
class CopilotoLiveOpenRouterTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Autowired MockMvc mvc;

    @BeforeEach
    void setUp() throws Exception {
        mvc.perform(post("/api/demo/reset"));
        mvc.perform(post("/api/clientes/cli-001/consentimentos/inst-horizonte/conceder"));
    }

    private JsonNode json(org.springframework.test.web.servlet.ResultActions r) throws Exception {
        return MAPPER.readTree(r.andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
    }

    @Test
    void mensagemDiversificarFgcRedigidaPeloAgente() throws Exception {
        JsonNode m = json(mvc.perform(post("/api/clientes/cli-001/acoes/acao-cli-001-fgc_excedido-cong-horizonte/mensagem")
                .contentType(MediaType.APPLICATION_JSON).content("{\"canal\":\"WHATSAPP\"}")));
        System.out.println("MENSAGEM LIVE: " + m);

        assertThat(m.get("geradoPor").asText()).isEqualTo("live");
        assertThat(m.get("texto").asText()).contains("Marina").contains("400").contains("Sofia")
                .doesNotContainIgnoringCase("rentabilidade garantida");
    }

    @Test
    void briefingRedigidoPeloAgente() throws Exception {
        JsonNode b = json(mvc.perform(get("/api/clientes/cli-001/briefing")));
        System.out.println("BRIEFING LIVE: " + b);

        assertThat(b.get("geradoPor").asText()).isEqualTo("live");
        assertThat(b.get("bullets").size()).isGreaterThanOrEqualTo(3);
        assertThat(b.get("perguntasSugeridas").size()).isGreaterThanOrEqualTo(1);
    }

    @Test
    void notaComFatosExtraidosPeloAgente() throws Exception {
        JsonNode r = json(mvc.perform(post("/api/clientes/cli-003/notas").contentType(MediaType.APPLICATION_JSON)
                .content("{\"transcricao\":\"Conversei com a Juliana. Ela vai se casar em maio de 2027 e quer juntar dinheiro para a festa.\"}")));
        System.out.println("NOTA LIVE: " + r);

        assertThat(r.get("geradoPor").asText()).isEqualTo("live");
        assertThat(r.get("eventosCriados").get(0).get("tipo").asText()).isEqualTo("CASAMENTO");
    }
}
