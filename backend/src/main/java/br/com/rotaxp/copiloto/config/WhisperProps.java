package br.com.rotaxp.copiloto.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Transcrição de áudio (edição do cadastro por voz). Qualquer API compatível com a /audio/transcriptions
 * da OpenAI serve: OpenAI, Groq ou um servidor Whisper local.
 */
@ConfigurationProperties("whisper")
public record WhisperProps(String url, String modelo, String apiKey, String idioma, int timeoutSegundos,
                           int tamanhoMaximoMb) {
    public boolean temChave() { return apiKey != null && !apiKey.isBlank(); }
}
