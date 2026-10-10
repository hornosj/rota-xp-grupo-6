package br.com.rotaxp.copiloto.agentes;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class AnthropicLlmClienteTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void corpoDaRequisicaoSegueAMessagesApi() throws Exception {
        String corpo = AnthropicLlmCliente.corpo(mapper, "claude-sonnet-5-5", 1024, "regras", "contexto");

        JsonNode json = mapper.readTree(corpo);
        assertThat(json.get("model").asText()).isEqualTo("claude-sonnet-5-5");
        assertThat(json.get("max_tokens").asInt()).isEqualTo(1024);
        assertThat(json.get("system").asText()).isEqualTo("regras");
        assertThat(json.get("messages").get(0).get("role").asText()).isEqualTo("user");
        assertThat(json.get("messages").get(0).get("content").asText()).isEqualTo("contexto");
    }

    @Test
    void extraiOTextoDosBlocosDeConteudo() throws Exception {
        String resposta = "{\"content\":[{\"type\":\"text\",\"text\":\"Olá\"},{\"type\":\"text\",\"text\":\", Marina\"}]}";

        assertThat(AnthropicLlmCliente.texto(mapper, resposta)).isEqualTo("Olá, Marina");
    }

    @Test
    void respostaDeErroViraExcecao() {
        assertThatThrownBy(() -> AnthropicLlmCliente.texto(mapper, "{\"type\":\"error\",\"error\":{\"message\":\"x\"}}"))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("x");
    }
}
