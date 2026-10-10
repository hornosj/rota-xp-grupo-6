package br.com.rotaxp.copiloto.api;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/** Simulação de rentabilidade com aportes (PLAN §7.11). */
@SpringBootTest
@AutoConfigureMockMvc
class RentabilidadeApiTest {

    static final String URL = "/api/simulacoes/rentabilidade";

    @Autowired MockMvc mvc;

    @Test
    void calculaGanhoETwrDoExemploDoPlan() throws Exception {
        String corpo = "{\"valorInicial\":50000,\"periodos\":[{\"retorno\":0.20,\"aporte\":25000},{\"retorno\":-0.08}]}";
        mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(corpo))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalAportado").value(75000.0))
                .andExpect(jsonPath("$.valorFinal").value(78200.0))
                .andExpect(jsonPath("$.ganho").value(3200.0))
                .andExpect(jsonPath("$.ganhoPercentual").value(0.042667))
                .andExpect(jsonPath("$.twr").value(0.104))
                .andExpect(jsonPath("$.periodos", hasSize(2)))
                .andExpect(jsonPath("$.periodos[1].twrAcumulado").value(0.104))
                .andExpect(jsonPath("$.explicacao").value(containsString("TWR")));
    }

    @Test
    void pedidoInvalidoDa400() throws Exception {
        mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content("{\"valorInicial\":1000,\"periodos\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.erro").value("REQUISICAO_INVALIDA"))
                .andExpect(jsonPath("$.mensagem").value(containsString("periodos")));
    }
}
