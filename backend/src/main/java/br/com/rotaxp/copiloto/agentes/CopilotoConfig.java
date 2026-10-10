package br.com.rotaxp.copiloto.agentes;

import br.com.rotaxp.copiloto.config.CopilotoProps;
import br.com.rotaxp.copiloto.config.WhisperProps;
import br.com.rotaxp.copiloto.demo.DataReferencia;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.http.HttpClient;
import java.nio.file.Path;
import java.time.Duration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class CopilotoConfig {

    @Bean
    public CacheLlm cacheLlm(CopilotoProps props, ObjectMapper mapper) {
        return new CacheLlm(Path.of(props.cacheDir()), mapper);
    }

    /** Trava de crédito: toda chamada real ao Embabel passa por aqui (copiloto.limite-chamadas-dia). */
    @Bean
    @Primary
    public LimiteChamadasLlm limiteChamadasLlm(ExecutorAgentesEmbabel embabel, DataReferencia relogio,
                                               @Value("${copiloto.limite-chamadas-dia:100}") int limiteDiario) {
        return new LimiteChamadasLlm(embabel, limiteDiario, relogio);
    }

    /** Edição do cadastro por voz: Whisper por HTTP, com timeout (whisper.timeout-segundos). */
    @Bean
    public Transcritor transcritor(WhisperProps props, RestClient.Builder builder) {
        Duration timeout = Duration.ofSeconds(props.timeoutSegundos());
        JdkClientHttpRequestFactory fabrica = new JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(timeout).build());
        fabrica.setReadTimeout(timeout);
        return new TranscritorWhisper(props, builder.baseUrl(props.url()).requestFactory(fabrica).build());
    }
}
