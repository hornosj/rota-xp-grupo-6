package br.com.rotaxp.copiloto.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("copiloto")
public record CopilotoProps(String modo, String modelo, String cacheDir, String apiKey, int maxTokens) {
    public boolean temChave() { return apiKey != null && !apiKey.isBlank(); }
}
