package br.com.rotaxp.copiloto.api;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.lessThanOrEqualTo;
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
import org.springframework.test.web.servlet.MockMvc;

/** Radar de notícias pela API, com a seed real e a classificação de referência (offline). */
@SpringBootTest
@AutoConfigureMockMvc
class RadarApiTest {

    @Autowired MockMvc mvc;

    @BeforeEach
    void reset() throws Exception {
        mvc.perform(post("/api/demo/reset")).andExpect(status().isNoContent());
    }

    @Test
    void noticiasProcessadasNoStartupMaisRecentesPrimeiro() throws Exception {
        mvc.perform(get("/api/radar/noticias")).andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(20)))
                .andExpect(jsonPath("$[0].noticia.id").value("not-020"))
                .andExpect(jsonPath("$[0].classificacao.origem").value("REFERENCIA"));
    }

    @Test
    void processarPontualmenteNaoReclassificaOQueJaFoiVisto() throws Exception {
        mvc.perform(post("/api/radar/processar")).andExpect(status().isOk())
                .andExpect(jsonPath("$.coletadas").value(20))
                .andExpect(jsonPath("$.novas").value(0));
    }

    @Test
    void radarDoRobertoTemOCraDaAgroSulEmPrimeiro() throws Exception {
        mvc.perform(get("/api/clientes/cli-005/radar")).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].noticiaId").value("not-001"))
                .andExpect(jsonPath("$[0].pontos").value(90.0))
                .andExpect(jsonPath("$[0].motivo").value("R$ 900 mil em CRA da Agro Sul Sementes S.A. (44,4% do patrimônio visível)"));
    }

    @Test
    void radarDaMarinaSegueOConsentimento() throws Exception {
        mvc.perform(get("/api/clientes/cli-001/radar"))
                .andExpect(jsonPath("$[*].noticiaId", not(hasItem("not-002"))));

        mvc.perform(post("/api/clientes/cli-001/consentimentos/inst-horizonte/conceder")).andExpect(status().isOk());

        mvc.perform(get("/api/clientes/cli-001/radar"))
                .andExpect(jsonPath("$[0].noticiaId").value("not-002"))
                .andExpect(jsonPath("$[0].motivo").value(containsString("R$ 650 mil em CDB do Banco Horizonte")));
    }

    @Test
    void radarDaCarteiraOrdenadoComLimite() throws Exception {
        mvc.perform(get("/api/assessor/radar").param("limite", "5")).andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(lessThanOrEqualTo(5))))
                .andExpect(jsonPath("$[0].clienteId").value("cli-005"))
                .andExpect(jsonPath("$[0].clienteNome").value("Roberto Lima"));
    }

    @Test
    void motivoDeContatoParaOAssessor() throws Exception {
        mvc.perform(post("/api/clientes/cli-005/radar/not-001/motivo")).andExpect(status().isOk())
                .andExpect(jsonPath("$.texto").value(containsString("Roberto")))
                .andExpect(jsonPath("$.texto").value(containsString("R$ 900 mil em CRA da Agro Sul")))
                .andExpect(jsonPath("$.geradoPor").value("stub"));

        mvc.perform(post("/api/clientes/cli-006/radar/not-001/motivo")).andExpect(status().isNotFound());
    }

    @Test
    void radarNaoMexeNaFila() throws Exception {
        mvc.perform(get("/api/assessor/fila")).andExpect(jsonPath("$[0].clienteId").value("cli-004"))
                .andExpect(jsonPath("$[0].prioridade").value(54.0));
    }
}
