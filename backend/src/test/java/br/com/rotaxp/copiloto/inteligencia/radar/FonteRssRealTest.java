package br.com.rotaxp.copiloto.inteligencia.radar;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotaxp.copiloto.config.RssProps;
import br.com.rotaxp.copiloto.dominio.Emissor;
import br.com.rotaxp.copiloto.dominio.Radar.Classificacao;
import br.com.rotaxp.copiloto.support.CenarioBuilder;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/** Feeds reais (rede). Opt-in: ./mvnw test -Dtest=FonteRssRealTest -Dradar.teste-rss=true */
@EnabledIfSystemProperty(named = "radar.teste-rss", matches = "true")
class FonteRssRealTest {

    @Test
    void osTresFeedsConfiguradosSaoLidosPeloParserSeguro() {
        HttpClient http = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NORMAL).connectTimeout(Duration.ofSeconds(10)).build();
        List<RssProps.Feed> feeds = List.of(
                new RssProps.Feed("InfoMoney", "https://www.infomoney.com.br/feed/"),
                new RssProps.Feed("CNN Brasil", "https://www.cnnbrasil.com.br/feed/"),
                new RssProps.Feed("Bloomberg Línea", "https://www.bloomberglinea.com.br/arc/outboundfeeds/rss/?outputType=xml"));
        FonteRss fonte = new FonteRss(new RssProps(true, 30, 10, feeds), url -> http.send(
                HttpRequest.newBuilder(URI.create(url)).header("User-Agent", "CopilotoDoAssessor/0.1").timeout(Duration.ofSeconds(15)).build(),
                HttpResponse.BodyHandlers.ofString()).body());

        List<NoticiaColetada> noticias = fonte.coletar();

        Map<String, Long> porFonte = noticias.stream().collect(Collectors.groupingBy(n -> n.noticia().fonte(), Collectors.counting()));
        System.out.println("RSS REAL por fonte: " + porFonte);
        Map<String, Emissor> emissores = CenarioBuilder.comInstituicoesPadrao().build().emissores().stream()
                .collect(Collectors.toMap(Emissor::id, Function.identity()));
        ClassificadorRegras regras = new ClassificadorRegras();
        long relevantes = noticias.stream().map(n -> regras.classificar(n.noticia(), emissores))
                .filter(c -> !c.indexadores().isEmpty() || !c.produtos().isEmpty()).count();
        System.out.println("RSS REAL com indexador/produto (regras): " + relevantes + " de " + noticias.size());
        noticias.stream().limit(3).forEach(n -> System.out.println("  - [" + n.noticia().fonte() + "] " + n.noticia().titulo()));

        assertThat(porFonte).containsKeys("InfoMoney", "CNN Brasil", "Bloomberg Línea");
        assertThat(noticias).allSatisfy(n -> assertThat(n.noticia().titulo()).isNotBlank());
    }
}
