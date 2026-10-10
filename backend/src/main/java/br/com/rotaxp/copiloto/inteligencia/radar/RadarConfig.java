package br.com.rotaxp.copiloto.inteligencia.radar;

import br.com.rotaxp.copiloto.agentes.ExecutorAgentes;
import br.com.rotaxp.copiloto.config.RadarProps;
import br.com.rotaxp.copiloto.config.RssProps;
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

    /** Feeds RSS reais: só com radar.rss.habilitado=true (a demo roda offline com as curadas). */
    @Bean
    @ConditionalOnProperty(prefix = "radar.rss", name = "habilitado", havingValue = "true")
    public FonteRss fonteRss(RssProps props) {
        java.net.http.HttpClient http = java.net.http.HttpClient.newBuilder()
                .connectTimeout(java.time.Duration.ofSeconds(props.timeoutSegundos()))
                .followRedirects(java.net.http.HttpClient.Redirect.NORMAL).build();
        return new FonteRss(props, url -> {
            var req = java.net.http.HttpRequest.newBuilder(java.net.URI.create(url))
                    .timeout(java.time.Duration.ofSeconds(props.timeoutSegundos()))
                    .header("User-Agent", "CopilotoDoAssessor/0.1 (hackathon; radar de noticias)").GET().build();
            var resp = http.send(req, java.net.http.HttpResponse.BodyHandlers.ofString(java.nio.charset.StandardCharsets.UTF_8));
            if (resp.statusCode() / 100 != 2) throw new java.io.IOException("HTTP " + resp.statusCode());
            return resp.body();
        });
    }

    /** Agendamento só quando o worker está habilitado. */
    @Configuration
    @EnableScheduling
    @ConditionalOnProperty(prefix = "radar", name = "worker-habilitado", havingValue = "true")
    static class Agendamento {}
}
