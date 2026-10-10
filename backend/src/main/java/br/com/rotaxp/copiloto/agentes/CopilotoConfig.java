package br.com.rotaxp.copiloto.agentes;

import br.com.rotaxp.copiloto.config.CopilotoProps;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Path;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class CopilotoConfig {

    @Bean
    public CacheLlm cacheLlm(CopilotoProps props, ObjectMapper mapper) {
        return new CacheLlm(Path.of(props.cacheDir()), mapper);
    }
}
