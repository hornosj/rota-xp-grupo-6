package br.com.rotaxp.copiloto.inteligencia.radar;

import br.com.rotaxp.copiloto.agentes.ExecutorAgentes;
import br.com.rotaxp.copiloto.config.RadarProps;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
public class RadarConfig {

    @Bean
    public ClassificadorLlm classificadorLlm(ExecutorAgentes agentes, ClassificadorRegras regras, RadarProps props) {
        return new ClassificadorLlm(agentes, regras, props.modeloClassificacao(), props.tamanhoLote());
    }

    @Bean
    public CruzamentoCarteira cruzamentoCarteira(RadarProps props) {
        return new CruzamentoCarteira(props.fracaoPlena(), props.pontosMinimos());
    }

    /** Agendamento só quando o worker está habilitado. */
    @Configuration
    @EnableScheduling
    @ConditionalOnProperty(prefix = "radar", name = "worker-habilitado", havingValue = "true")
    static class Agendamento {}
}
