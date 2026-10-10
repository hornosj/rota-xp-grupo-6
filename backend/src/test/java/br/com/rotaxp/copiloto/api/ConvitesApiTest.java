package br.com.rotaxp.copiloto.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/** Roteiro do reescopo (PLAN §1) pela API: convidar → mensagem com link → confirmar → Marina em 1º. */
@SpringBootTest
@AutoConfigureMockMvc
class ConvitesApiTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    static final String MARINA = "/api/clientes/cli-001";
    static final String ACAO_CONVITE = "acao-cli-001-convidar_conexao-inst-horizonte";

    @Autowired MockMvc mvc;

    @BeforeEach
    void reset() throws Exception {
        mvc.perform(post("/api/demo/reset")).andExpect(status().isNoContent());
    }

    private JsonNode json(ResultActions r) throws Exception {
        return MAPPER.readTree(r.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    private JsonNode convidar() throws Exception {
        return json(mvc.perform(post(MARINA + "/convites/inst-horizonte")).andExpect(status().isOk()));
    }

    @Test
    void roteiroConvidarConfirmarMarinaEmPrimeiro() throws Exception {
        mvc.perform(get("/api/assessor/fila")).andExpect(jsonPath("$[1].clienteId").value("cli-001"));

        JsonNode convite = convidar();
        assertThat(convite.get("status").asText()).isEqualTo("PENDENTE");
        assertThat(convite.get("instituicaoNome").asText()).isEqualTo("Banco Horizonte");
        assertThat(convite.get("prazoMeses").asInt()).isEqualTo(12);
        String token = convite.get("token").asText();
        assertThat(convite.get("link").asText()).isEqualTo("http://localhost:3000/convite/" + token);

        mvc.perform(get(MARINA + "/convites")).andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].token").value(token));
        mvc.perform(get("/api/convites/" + token)).andExpect(jsonPath("$.clienteId").value("cli-001"));

        mvc.perform(post("/api/convites/" + token + "/confirmar")).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONFIRMADO"));

        mvc.perform(get(MARINA + "/360")).andExpect(jsonPath("$.cobertura.percentual").value(1.0));
        mvc.perform(get("/api/assessor/fila"))
                .andExpect(jsonPath("$[0].clienteId").value("cli-001"))
                .andExpect(jsonPath("$[0].novo").value(true))
                .andExpect(jsonPath("$[0].acaoPrincipal.tipo").value("DIVERSIFICAR_FGC"));
    }

    @Test
    void mensagemDoConviteTrazOLinkECriaOConviteSeNaoExistir() throws Exception {
        JsonNode m = json(mvc.perform(post(MARINA + "/acoes/" + ACAO_CONVITE + "/mensagem")
                .contentType(MediaType.APPLICATION_JSON).content("{\"canal\":\"WHATSAPP\"}")).andExpect(status().isOk()));
        JsonNode convites = json(mvc.perform(get(MARINA + "/convites")));

        assertThat(convites).hasSize(1);
        String link = convites.get(0).get("link").asText();
        assertThat(m.get("texto").asText()).isEqualTo("Oi, Marina! Para eu enxergar seu patrimônio completo e checar sua "
                + "proteção no FGC, você pode conectar o Banco Horizonte por aqui: " + link
                + ". Leva 1 minuto e você pode revogar quando quiser.");

        // enviar convite depois reaproveita o mesmo
        assertThat(convidar().get("link").asText()).isEqualTo(link);
    }

    @Test
    void erros() throws Exception {
        String token = convidar().get("token").asText();
        mvc.perform(post("/api/convites/" + token + "/confirmar")).andExpect(status().isOk());

        mvc.perform(post("/api/convites/" + token + "/confirmar")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.erro").value("CONFLITO"));
        mvc.perform(post(MARINA + "/convites/inst-aurora")).andExpect(status().isConflict());
        mvc.perform(get("/api/convites/cv-nao-existe")).andExpect(status().isNotFound());
        mvc.perform(post(MARINA + "/convites/inst-nao-existe")).andExpect(status().isNotFound());
    }

    @Test
    void resetApagaOsConvites() throws Exception {
        String token = convidar().get("token").asText();

        mvc.perform(post("/api/demo/reset")).andExpect(status().isNoContent());

        mvc.perform(get(MARINA + "/convites")).andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(get("/api/convites/" + token)).andExpect(status().isNotFound());
        assertThat(convidar().get("token").asText()).isEqualTo(token);   // determinístico
    }

    @Test
    void openApiExpoeOConvite() throws Exception {
        mvc.perform(get("/v3/api-docs")).andExpect(jsonPath("$.components.schemas.Convite").exists());
    }
}
