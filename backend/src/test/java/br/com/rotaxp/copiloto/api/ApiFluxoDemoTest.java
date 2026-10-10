package br.com.rotaxp.copiloto.api;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/** Critérios de aceite do BE1/BE2 e o roteiro da demo (PLAN §1) pela API. */
@SpringBootTest
@AutoConfigureMockMvc
class ApiFluxoDemoTest {

    static final String MARINA = "/api/clientes/cli-001";

    @Autowired MockMvc mvc;

    @BeforeEach
    void reset() throws Exception {
        mvc.perform(post("/api/demo/reset")).andExpect(status().isNoContent());
    }

    private void concederHorizonte() throws Exception {
        mvc.perform(post(MARINA + "/consentimentos/inst-horizonte/conceder")).andExpect(status().isOk());
    }

    @Test
    void horizonteInvisivelAteConcederEResetVolta() throws Exception {
        mvc.perform(get(MARINA + "/360")).andExpect(status().isOk())
                .andExpect(jsonPath("$.cobertura.percentual").value(0.667))
                .andExpect(jsonPath("$.patrimonio.totalVisivel").value(985000.0))
                .andExpect(jsonPath("$.patrimonio.porInstituicao[*].instituicaoId", not(hasItem("inst-horizonte"))));

        mvc.perform(post(MARINA + "/consentimentos/inst-horizonte/conceder")).andExpect(status().isOk())
                .andExpect(jsonPath("$.cobertura.percentual").value(1.0))
                .andExpect(jsonPath("$.patrimonio.totalVisivel").value(1635000.0));

        mvc.perform(post("/api/demo/reset")).andExpect(status().isNoContent());
        mvc.perform(get(MARINA + "/360")).andExpect(jsonPath("$.cobertura.percentual").value(0.667));
    }

    @Test
    void erros() throws Exception {
        concederHorizonte();
        mvc.perform(post(MARINA + "/consentimentos/inst-horizonte/conceder")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.erro").value("CONFLITO"));
        mvc.perform(get("/api/clientes/cli-999/360")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.erro").value("NAO_ENCONTRADO"))
                .andExpect(jsonPath("$.mensagem").value(containsString("cli-999")));
        mvc.perform(post(MARINA + "/consentimentos/inst-xyz/conceder")).andExpect(status().isNotFound());
    }

    @Test
    void listasEPrincipalidade() throws Exception {
        mvc.perform(get("/api/clientes")).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(36)))
                .andExpect(jsonPath("$[0].id").value("cli-004"));
        mvc.perform(get(MARINA + "/principalidade")).andExpect(jsonPath("$.instituicaoPrincipalNome").value("Banco Aurora"))
                .andExpect(jsonPath("$.explicacao").value(containsString("A XP tem 15 pontos: só investimentos")));
        mvc.perform(get(MARINA + "/consentimentos")).andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[?(@.instituicaoId=='inst-horizonte')].status").value("PENDENTE"));
        mvc.perform(get("/api/assessor/painel")).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalClientes").value(36))
                .andExpect(jsonPath("$.distribuicaoPosicaoXp.PRINCIPAL").isNumber());
    }

    @Test
    void revogar() throws Exception {
        concederHorizonte();
        mvc.perform(post(MARINA + "/consentimentos/inst-horizonte/revogar")).andExpect(status().isOk())
                .andExpect(jsonPath("$.cobertura.percentual").value(0.667));
    }

    @Test
    void jornadaFoiRemovidaNoReescopo() throws Exception {
        mvc.perform(get(MARINA + "/jornada")).andExpect(status().isNotFound());
        mvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.components.schemas.Jornada").doesNotExist())
                .andExpect(jsonPath("$.components.schemas.Missao").doesNotExist())
                .andExpect(jsonPath("$.components.schemas.Diagnostico").doesNotExist());
    }

    @Test
    void mensagemDiversificarFgcSemChaveDeApi() throws Exception {
        concederHorizonte();
        mvc.perform(post(MARINA + "/acoes/acao-cli-001-fgc_excedido-cong-horizonte/mensagem")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"canal\":\"WHATSAPP\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.texto").value(containsString("R$ 400 mil")))
                .andExpect(jsonPath("$.texto").value(containsString("Sofia")))
                .andExpect(jsonPath("$.texto").value(not(containsString("rentabilidade"))))
                .andExpect(jsonPath("$.canal").value("WHATSAPP"))
                .andExpect(jsonPath("$.geradoPor").value("stub"));
        mvc.perform(post(MARINA + "/acoes/acao-inexistente/mensagem")
                .contentType(MediaType.APPLICATION_JSON).content("{\"canal\":\"WHATSAPP\"}")).andExpect(status().isNotFound());
    }

    @Test
    void briefingENotaPersistemEventos() throws Exception {
        mvc.perform(get(MARINA + "/briefing")).andExpect(status().isOk())
                .andExpect(jsonPath("$.bullets", hasSize(5))).andExpect(jsonPath("$.perguntasSugeridas", hasSize(3)));

        mvc.perform(post("/api/clientes/cli-003/notas").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"transcricao\":\"Ela vai casar ano que vem. Quer comprar um apartamento.\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eventosCriados[0].tipo").value("CASAMENTO"));
        mvc.perform(get("/api/clientes/cli-003/360"))
                .andExpect(jsonPath("$.cliente.eventosVida[*].origem", hasItem("NOTA_REUNIAO")));
    }

    @Test
    void demoEstadoEDesagio() throws Exception {
        mvc.perform(get("/api/demo/estado")).andExpect(jsonPath("$.dataReferencia").value("2026-10-10"))
                .andExpect(jsonPath("$.modoCopiloto").value("stub"))
                .andExpect(jsonPath("$.modeloLlm").value("deepseek/deepseek-v4-pro"))
                .andExpect(jsonPath("$.llm.chamadasHoje").value(0))
                .andExpect(jsonPath("$.llm.limiteDiario").value(100));
        mvc.perform(post("/api/simulacoes/desagio").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"desagio\":0.03,\"taxaAntiga\":0.12,\"taxaNova\":0.14,\"prazoRestanteAnos\":3}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.breakEvenAnos").value(1.7))
                .andExpect(jsonPath("$.compensa").value(true))
                .andExpect(jsonPath("$.explicacao").value(containsString("IR")));
    }

    @Test
    void openApiExpoeOsSchemas() throws Exception {
        mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andExpect(jsonPath("$.components.schemas.Visao360").exists())
                .andExpect(jsonPath("$.components.schemas.ItemFila").exists())
                .andExpect(jsonPath("$.components.schemas.Convite").exists());
    }
}
