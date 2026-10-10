package br.com.rotaxp.copiloto.agentes;

import br.com.rotaxp.copiloto.config.CopilotoProps;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.springframework.stereotype.Component;

/** Claude via Messages API (HTTP puro). A chave vem de ANTHROPIC_API_KEY. */
@Component
public class AnthropicLlmCliente implements LlmCliente {

    static final URI URL = URI.create("https://api.anthropic.com/v1/messages");
    static final String VERSAO_API = "2023-06-01";

    private final CopilotoProps props;
    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    public AnthropicLlmCliente(CopilotoProps props, ObjectMapper mapper) {
        this.props = props;
        this.mapper = mapper;
    }

    @Override
    public String completar(String system, String user) {
        if (!props.temChave()) throw new IllegalStateException("ANTHROPIC_API_KEY não configurada");
        HttpRequest req = HttpRequest.newBuilder(URL)
                .timeout(Duration.ofSeconds(60))
                .header("content-type", "application/json")
                .header("x-api-key", props.apiKey())
                .header("anthropic-version", VERSAO_API)
                .POST(HttpRequest.BodyPublishers.ofString(corpo(mapper, props.modelo(), props.maxTokens(), system, user)))
                .build();
        try {
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            return texto(mapper, resp.body());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }

    static String corpo(ObjectMapper mapper, String modelo, int maxTokens, String system, String user) {
        ObjectNode json = mapper.createObjectNode();
        json.put("model", modelo);
        json.put("max_tokens", maxTokens);
        json.put("system", system);
        ObjectNode msg = json.putArray("messages").addObject();
        msg.put("role", "user");
        msg.put("content", user);
        return json.toString();
    }

    static String texto(ObjectMapper mapper, String resposta) throws IOException {
        JsonNode json = mapper.readTree(resposta);
        if (json.has("error")) throw new IllegalStateException("Erro da API: " + json.get("error").path("message").asText());
        StringBuilder sb = new StringBuilder();
        for (JsonNode bloco : json.path("content")) {
            if ("text".equals(bloco.path("type").asText())) sb.append(bloco.path("text").asText());
        }
        return sb.toString();
    }
}
