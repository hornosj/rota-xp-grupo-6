package br.com.rotaxp.copiloto.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * O front chama a API pelo proxy do Next, que repassa o header Origin do navegador. O front local pode
 * rodar em qualquer porta (3000, 3010...): todas precisam passar. Origem externa continua bloqueada.
 */
@SpringBootTest
@AutoConfigureMockMvc
class CorsTest {

    @Autowired MockMvc mvc;

    @ParameterizedTest
    @ValueSource(strings = {"http://localhost:3000", "http://localhost:3010", "http://127.0.0.1:3093"})
    void frontLocalEmQualquerPortaPodePostar(String origem) throws Exception {
        mvc.perform(post("/api/clientes/cli-001/acoes/acao-cli-001-saldo_parado/mensagem")
                        .header("Origin", origem).contentType(MediaType.APPLICATION_JSON).content("{\"canal\":\"EMAIL\"}"))
                .andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"https://site-malicioso.example", "http://localhost.example.com:3000"})
    void origemExternaContinuaBloqueada(String origem) throws Exception {
        mvc.perform(post("/api/demo/reset").header("Origin", origem)).andExpect(status().isForbidden());
    }
}
