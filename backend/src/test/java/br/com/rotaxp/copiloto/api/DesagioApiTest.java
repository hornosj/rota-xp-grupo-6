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

/** Calculadora de deságio da tela do assessor, com a seed real. */
@SpringBootTest
@AutoConfigureMockMvc
class DesagioApiTest {

    static final String MARINA = "/api/clientes/cli-001";
    static final String SIMULAR = "/api/simulacoes/desagio/detalhado";

    @Autowired MockMvc mvc;

    @BeforeEach
    void reset() throws Exception {
        mvc.perform(post("/api/demo/reset")).andExpect(status().isNoContent());
    }

    @Test
    void posicoesSoMostramOQueOConsentimentoLibera() throws Exception {
        mvc.perform(get(MARINA + "/desagio/posicoes")).andExpect(status().isOk())
                .andExpect(jsonPath("$.clienteId").value("cli-001"))
                .andExpect(jsonPath("$.dataReferencia").value("2026-10-10"))
                .andExpect(jsonPath("$.premissas.cdiAnual").value(0.10))
                .andExpect(jsonPath("$.posicoes[*].posicaoId", not(hasItem("inv-001-06"))))
                .andExpect(jsonPath("$.posicoes[0].posicaoId").value("inv-001-03"))
                .andExpect(jsonPath("$.posicoes[0].elegivel").value(true))
                .andExpect(jsonPath("$.posicoes[0].taxaAnualEstimada").value(0.112))
                .andExpect(jsonPath("$.posicoes[?(@.posicaoId=='inv-001-04')].motivoInelegibilidade",
                        hasItem(containsString("liquidez diária"))))
                .andExpect(jsonPath("$.posicoes[?(@.posicaoId=='inv-001-02')].elegivel", hasItem(false)));

        mvc.perform(post(MARINA + "/consentimentos/inst-horizonte/conceder")).andExpect(status().isOk());
        mvc.perform(get(MARINA + "/desagio/posicoes")).andExpect(status().isOk())
                .andExpect(jsonPath("$.posicoes[?(@.posicaoId=='inv-001-06')].elegivel", hasItem(true)))
                .andExpect(jsonPath("$.posicoes[?(@.posicaoId=='inv-001-06')].valorAtual", hasItem(650000.0)));
    }

    @Test
    void clienteInexistenteDa404() throws Exception {
        mvc.perform(get("/api/clientes/cli-999/desagio/posicoes")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.erro").value("NAO_ENCONTRADO"));
    }

    @Test
    void simulaAPartirDaPosicao() throws Exception {
        mvc.perform(post(SIMULAR).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"clienteId\":\"cli-001\",\"posicaoId\":\"inv-001-03\",\"desagio\":0.03,\"taxaNova\":0.135}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entrada.posicaoNome").value("CDB Banco Ipê 2028"))
                .andExpect(jsonPath("$.entrada.valorAtual").value(160000.0))
                .andExpect(jsonPath("$.entrada.precoVenda").value(155200.0))
                .andExpect(jsonPath("$.perdaImediata").value(4800.0))
                .andExpect(jsonPath("$.compensa").value(true))
                .andExpect(jsonPath("$.breakEvenAnos").value(1.49))
                .andExpect(jsonPath("$.serie[0].diferenca").value(-4800.0))
                .andExpect(jsonPath("$.avisos", hasSize(1)))
                .andExpect(jsonPath("$.explicacao").value(containsString("IR")));
    }

    @Test
    void simulaManualECompatibilidadeComOEndpointAntigo() throws Exception {
        mvc.perform(post(SIMULAR).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"valorAtual\":100000,\"taxaAntiga\":0.12,\"prazoRestanteAnos\":3,\"precoVenda\":97000,\"taxaNova\":0.14}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.breakEvenAnos").value(1.72))
                .andExpect(jsonPath("$.desagioMaximoQueCompensa").value(0.051714));

        mvc.perform(post("/api/simulacoes/desagio").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"desagio\":0.03,\"taxaAntiga\":0.12,\"taxaNova\":0.14,\"prazoRestanteAnos\":3}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.breakEvenAnos").value(1.7));
    }

    @Test
    void posicaoDoHorizonteSoExisteDepoisDoConsentimento() throws Exception {
        String corpo = "{\"clienteId\":\"cli-001\",\"posicaoId\":\"inv-001-06\",\"desagio\":0.02,\"taxaNova\":0.13}";
        mvc.perform(post(SIMULAR).contentType(MediaType.APPLICATION_JSON).content(corpo))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.erro").value("NAO_ENCONTRADO"));

        mvc.perform(post(MARINA + "/consentimentos/inst-horizonte/conceder")).andExpect(status().isOk());
        mvc.perform(post(SIMULAR).contentType(MediaType.APPLICATION_JSON).content(corpo))
                .andExpect(status().isOk()).andExpect(jsonPath("$.entrada.valorAtual").value(650000.0));
    }

    @Test
    void pedidoInvalidoDa400() throws Exception {
        mvc.perform(post(SIMULAR).contentType(MediaType.APPLICATION_JSON).content("{\"desagio\":0.03,\"taxaNova\":0.14}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.erro").value("REQUISICAO_INVALIDA"))
                .andExpect(jsonPath("$.mensagem").value(containsString("valorAtual")));

        mvc.perform(post(SIMULAR).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"clienteId\":\"cli-001\",\"posicaoId\":\"inv-001-04\",\"desagio\":0.03,\"taxaNova\":0.14}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.mensagem").value(containsString("liquidez diária")));
    }
}