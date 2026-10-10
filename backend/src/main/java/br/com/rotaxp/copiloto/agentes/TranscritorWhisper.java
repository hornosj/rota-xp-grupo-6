package br.com.rotaxp.copiloto.agentes;

import br.com.rotaxp.copiloto.config.WhisperProps;
import br.com.rotaxp.copiloto.dominio.Edicao.Transcricao;
import br.com.rotaxp.copiloto.dominio.Excecoes.FalhaExterna;
import br.com.rotaxp.copiloto.dominio.Excecoes.Indisponivel;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/** Whisper no formato da API da OpenAI: POST {whisper.url}/audio/transcriptions (multipart). */
public class TranscritorWhisper implements Transcritor {

    private static final Logger log = LoggerFactory.getLogger(TranscritorWhisper.class);

    /** Resposta com response_format=json. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    record RespostaWhisper(String text) {}

    private final WhisperProps props;
    private final RestClient http;

    /** @param http já com a base whisper.url e os timeouts (ver CopilotoConfig) */
    public TranscritorWhisper(WhisperProps props, RestClient http) {
        this.props = props;
        this.http = http;
    }

    @Override
    public boolean disponivel() {
        return props.temChave();
    }

    @Override
    public String modelo() {
        return props.modelo();
    }

    @Override
    public Transcricao transcrever(byte[] audio, String nomeArquivo, String dica) {
        if (!props.temChave()) {
            throw new Indisponivel("Transcrição por voz não configurada (defina WHISPER_APIKEY). Digite o que mudou.");
        }
        MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
        form.add("file", new ByteArrayResource(audio) {
            @Override public String getFilename() { return nomeArquivo; }
        });
        form.add("model", props.modelo());
        form.add("language", props.idioma());
        form.add("response_format", "json");
        if (dica != null && !dica.isBlank()) form.add("prompt", dica);
        try {
            RespostaWhisper r = http.post().uri("/audio/transcriptions")
                    .headers(h -> h.setBearerAuth(props.apiKey()))
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(form)
                    .retrieve()
                    .body(RespostaWhisper.class);
            return new Transcricao(r == null || r.text() == null ? "" : r.text().strip(), props.modelo());
        } catch (RestClientException e) {
            log.warn("Whisper falhou ({}): {}", props.modelo(), e.getMessage());
            throw new FalhaExterna("Não foi possível transcrever o áudio agora. Tente de novo ou digite o que mudou.", e);
        }
    }
}
