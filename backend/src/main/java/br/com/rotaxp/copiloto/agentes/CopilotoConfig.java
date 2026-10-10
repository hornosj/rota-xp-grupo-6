package br.com.rotaxp.copiloto.agentes;

import br.com.rotaxp.copiloto.config.CopilotoProps;
import br.com.rotaxp.copiloto.demo.DataReferencia;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
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

    /** Trava de crédito: toda chamada real ao Embabel passa por aqui (copiloto.limite-chamadas-dia). */
    @Bean
    @Primary
    public LimiteChamadasLlm limiteChamadasLlm(ExecutorAgentesEmbabel embabel, DataReferencia relogio,
                                               @Value("${copiloto.limite-chamadas-dia:100}") int limiteDiario) {
        return new LimiteChamadasLlm(embabel, limiteDiario, relogio);
    }
}
