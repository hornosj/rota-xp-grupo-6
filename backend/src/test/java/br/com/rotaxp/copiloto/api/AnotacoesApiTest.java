package br.com.rotaxp.copiloto.api;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
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
import org.springframework.test.web.servlet.ResultActions;

/** Editar cliente: nota de áudio (já transcrita no navegador) vira contexto do Copiloto e produto recomendado. */
@SpringBootTest
@AutoConfigureMockMvc
class AnotacoesApiTest {

    static final String JULIANA = "/api/clientes/cli-003";

    @Autowired MockMvc mvc;

    @BeforeEach
    void reset() throws Exception {
        mvc.perform(post("/api/demo/reset")).andExpect(status().isNoContent());
    }

    private ResultActions nota(String corpo) throws Exception {
        return mvc.perform(post(JULIANA + "/notas").contentType(MediaType.APPLICATION_JSON).content(corpo));
    }

    @Test
    void notaDeAudioViraContextoDoCopilotoERecomendaProduto() throws Exception {
        nota("{\"transcricao\":\"A Juliana bateu o carro semana passada.\",\"origem\":\"AUDIO\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.necessidades[0].tipo").value("PROTECAO_VEICULO"))
                .andExpect(jsonPath("$.recomendacoes[0].necessidade").value("PROTECAO_VEICULO"))
                .andExpect(jsonPath("$.recomendacoes[0].produto").value("Seguro auto"))
                .andExpect(jsonPath("$.recomendacoes[0].motivo").value("A Juliana bateu o carro semana passada"));

        mvc.perform(get(JULIANA + "/contexto")).andExpect(status().isOk())
                .andExpect(jsonPath("$.clienteId").value("cli-003"))
                .andExpect(jsonPath("$.anotacoes", hasSize(1)))
                .andExpect(jsonPath("$.anotacoes[0].texto").value("A Juliana bateu o carro semana passada."))
                .andExpect(jsonPath("$.anotacoes[0].origem").value("AUDIO"))
                .andExpect(jsonPath("$.anotacoes[0].data").value("2026-10-11"))
                .andExpect(jsonPath("$.recomendacoes[0].produto").value("Seguro auto"));

        mvc.perform(get(JULIANA + "/briefing"))
                .andExpect(jsonPath("$.bullets", hasItem("Contexto do assessor: A Juliana bateu o carro semana passada.")));
    }

    @Test
    void notaSemOrigemEhTextoEResetApagaOContexto() throws Exception {
        nota("{\"transcricao\":\"Quer juntar dinheiro para a faculdade do filho.\"}").andExpect(status().isOk());
        mvc.perform(get(JULIANA + "/contexto")).andExpect(jsonPath("$.anotacoes[0].origem").value("TEXTO"));

        mvc.perform(post("/api/demo/reset")).andExpect(status().isNoContent());

        mvc.perform(get(JULIANA + "/contexto"))
                .andExpect(jsonPath("$.anotacoes", hasSize(0)))
                .andExpect(jsonPath("$.recomendacoes", hasSize(0)));
    }

    @Test
    void notaVaziaEhRequisicaoInvalidaEClienteInexistenteEh404() throws Exception {
        nota("{\"transcricao\":\"   \"}").andExpect(status().isBadRequest());
        mvc.perform(get(JULIANA + "/contexto")).andExpect(jsonPath("$.anotacoes", hasSize(0)));
        mvc.perform(post("/api/clientes/cli-999/notas").contentType(MediaType.APPLICATION_JSON)
                .content("{\"transcricao\":\"oi\"}")).andExpect(status().isNotFound());
        mvc.perform(get("/api/clientes/cli-999/contexto")).andExpect(status().isNotFound());
    }
}
