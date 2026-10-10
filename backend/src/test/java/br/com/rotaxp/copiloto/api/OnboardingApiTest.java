package br.com.rotaxp.copiloto.api;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/** Convite → formulário → cadastro: o investidor vira um cliente de verdade na carteira. */
@SpringBootTest
@AutoConfigureMockMvc
class OnboardingApiTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;

    @BeforeEach
    void reset() throws Exception {
        mvc.perform(post("/api/demo/reset")).andExpect(status().isNoContent());
    }

    private String criarConvite(String nome) throws Exception {
        String corpo = mvc.perform(post("/api/assessor/convites").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"" + nome + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDENTE"))
                .andExpect(jsonPath("$.assessorId").value("ass-001"))
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(corpo).get("token").asText();
    }

    /** Cadastro válido: Aurora com conta/cartão (autoriza agora) e Ipê com investimentos (fica pendente). */
    private String cadastro(String cpf, String opcaoSuitability) {
        return """
            {
              "nome": "Carla Mendes Rocha", "cpf": "%s", "dataNascimento": "1988-05-20",
              "email": "carla@exemplo.com", "celular": "(11) 98888-7777",
              "profissao": "Engenheira civil", "cidade": "Campinas", "uf": "sp",
              "dependentes": [{ "nome": "Lia", "parentesco": "filha", "dataNascimento": "2019-10-14" }],
              "eventosVida": [{ "tipo": "CASAMENTO", "descricao": "Casamento da Carla", "data": "2027-02-10" }],
              "respostasSuitability": [
                { "perguntaId": "objetivo", "opcaoId": "%2$s" }, { "perguntaId": "prazo", "opcaoId": "%2$s" },
                { "perguntaId": "queda", "opcaoId": "%2$s" }, { "perguntaId": "experiencia", "opcaoId": "%2$s" },
                { "perguntaId": "reserva", "opcaoId": "%2$s" }
              ],
              "instituicoes": [
                { "instituicaoId": "inst-aurora", "produtos": ["CONTA", "CARTAO"], "compartilharAgora": true },
                { "instituicaoId": "inst-ipe", "produtos": ["INVESTIMENTOS"], "compartilharAgora": false }
              ],
              "aceiteTermos": true
            }
            """.formatted(cpf, opcaoSuitability);
    }

    private ResultActions concluir(String token, String corpo) throws Exception {
        return mvc.perform(post("/api/onboarding/" + token).contentType(MediaType.APPLICATION_JSON).content(corpo));
    }

    @Test
    void fluxoCompletoCriaClienteNaCarteira() throws Exception {
        String token = criarConvite("Carla Mendes");

        mvc.perform(get("/api/onboarding/" + token)).andExpect(status().isOk())
                .andExpect(jsonPath("$.convite.status").value("ABERTO"))
                .andExpect(jsonPath("$.convite.nome").value("Carla Mendes"))
                .andExpect(jsonPath("$.convite.link").value("/onboarding/" + token))
                .andExpect(jsonPath("$.questionario", hasSize(5)))
                .andExpect(jsonPath("$.questionario[0].opcoes[0].pontos").doesNotExist())
                .andExpect(jsonPath("$.instituicoes[*].id", not(hasItem("inst-xp"))))
                .andExpect(jsonPath("$.produtos", hasSize(4)));

        String corpo = concluir(token, cadastro("123.456.789-00", "c")).andExpect(status().isOk())
                .andExpect(jsonPath("$.clienteId").value("cli-201"))
                .andExpect(jsonPath("$.perfil").value("ARROJADO"))
                .andExpect(jsonPath("$.pontuacaoSuitability").value(15))
                .andExpect(jsonPath("$.convite.status").value("CONCLUIDO"))
                .andExpect(jsonPath("$.convite.clienteId").value("cli-201"))
                .andExpect(jsonPath("$.consentimentos", hasSize(3)))
                .andExpect(jsonPath("$.consentimentos[?(@.instituicaoId=='inst-xp')].tipo").value("INTERNO"))
                .andExpect(jsonPath("$.consentimentos[?(@.instituicaoId=='inst-aurora')].status").value("ATIVO"))
                .andExpect(jsonPath("$.consentimentos[?(@.instituicaoId=='inst-aurora')].expiraEm").value("2027-10-11"))
                .andExpect(jsonPath("$.consentimentos[?(@.instituicaoId=='inst-ipe')].status").value("PENDENTE"))
                .andReturn().getResponse().getContentAsString();
        JsonNode r = mapper.readTree(corpo);
        String cliente = "/api/clientes/" + r.get("clienteId").asText();

        mvc.perform(get(cliente + "/360")).andExpect(status().isOk())
                .andExpect(jsonPath("$.cliente.nome").value("Carla Mendes Rocha"))
                .andExpect(jsonPath("$.cliente.cpf").value("123.456.789-00"))
                .andExpect(jsonPath("$.cliente.idade").value(38))
                .andExpect(jsonPath("$.cliente.cidade").value("Campinas/SP"))
                .andExpect(jsonPath("$.cliente.assessorId").value("ass-001"))
                .andExpect(jsonPath("$.cliente.dependentes[0].parentesco").value("FILHA"))
                .andExpect(jsonPath("$.cliente.eventosVida[0].origem").value("CADASTRO"))
                .andExpect(jsonPath("$.cliente.instituicoesDeclaradas", hasSize(3)))
                .andExpect(jsonPath("$.cobertura.instituicoesDeclaradas").value(3))
                .andExpect(jsonPath("$.cobertura.pendentes[0].instituicaoId").value("inst-ipe"));

        mvc.perform(get(cliente + "/jornada")).andExpect(status().isOk())
                .andExpect(jsonPath("$.missoes[*].instituicaoId", hasItem("inst-ipe")));
        mvc.perform(get("/api/clientes")).andExpect(jsonPath("$", hasSize(37)))
                .andExpect(jsonPath("$[*].id", hasItem("cli-201")));
        mvc.perform(get("/api/assessor/fila")).andExpect(status().isOk())
                .andExpect(jsonPath("$[*].clienteId", hasItem("cli-201")));

        // A conexão pendente segue o fluxo normal de consentimento.
        mvc.perform(post(cliente + "/consentimentos/inst-ipe/conceder")).andExpect(status().isOk())
                .andExpect(jsonPath("$.cobertura.percentual").value(1.0));

        mvc.perform(get("/api/assessor/convites")).andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].status").value("CONCLUIDO"))
                .andExpect(jsonPath("$[0].perfil").value("ARROJADO"));
    }

    @Test
    void naoConcluiDuasVezesNemRepeteCpf() throws Exception {
        String token = criarConvite("Carla");
        concluir(token, cadastro("12345678900", "a")).andExpect(status().isOk())
                .andExpect(jsonPath("$.perfil").value("CONSERVADOR"));
        concluir(token, cadastro("99999999999", "a")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.erro").value("CONFLITO"));

        concluir(criarConvite("Outra"), cadastro("123.456.789-00", "a")).andExpect(status().isConflict());
        concluir(criarConvite("Seed"), cadastro("000.000.001-01", "a")).andExpect(status().isConflict());
    }

    @Test
    void validacoes() throws Exception {
        String token = criarConvite("Carla");
        String ok = cadastro("12345678900", "b");
        concluir(token, ok.replace("\"cpf\": \"12345678900\"", "\"cpf\": \"123\"")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.erro").value("INVALIDO"))
                .andExpect(jsonPath("$.mensagem", startsWith("CPF")));
        concluir(token, ok.replace("1988-05-20", "2015-01-01")).andExpect(status().isBadRequest());
        concluir(token, ok.replace("carla@exemplo.com", "carla")).andExpect(status().isBadRequest());
        concluir(token, ok.replace("\"aceiteTermos\": true", "\"aceiteTermos\": false")).andExpect(status().isBadRequest());
        concluir(token, ok.replace("inst-ipe", "inst-xp")).andExpect(status().isBadRequest());
        concluir(token, ok.replace("\"opcaoId\": \"b\" }, { \"perguntaId\": \"prazo\"", "\"opcaoId\": \"x\" }, { \"perguntaId\": \"prazo\""))
                .andExpect(status().isBadRequest());
        concluir(token, ok.replace("2027-02-10", "2020-01-01")).andExpect(status().isBadRequest());

        // Nada foi criado com as tentativas inválidas: o convite continua aberto.
        mvc.perform(get("/api/clientes")).andExpect(jsonPath("$", hasSize(36)));
        concluir(token, ok).andExpect(status().isOk());

        mvc.perform(post("/api/assessor/convites").contentType(MediaType.APPLICATION_JSON).content("{\"nome\":\" \"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/onboarding/inexistente")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.erro").value("NAO_ENCONTRADO"));
    }

    @Test
    void resetApagaConvitesEClientesCadastrados() throws Exception {
        String token = criarConvite("Carla");
        concluir(token, cadastro("12345678900", "d")).andExpect(status().isOk());
        mvc.perform(post("/api/demo/reset")).andExpect(status().isNoContent());

        mvc.perform(get("/api/assessor/convites")).andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(get("/api/clientes")).andExpect(jsonPath("$", hasSize(36)));
        mvc.perform(get("/api/clientes/cli-201/360")).andExpect(status().isNotFound());
        mvc.perform(get("/api/onboarding/" + token)).andExpect(status().isNotFound());
    }
}
