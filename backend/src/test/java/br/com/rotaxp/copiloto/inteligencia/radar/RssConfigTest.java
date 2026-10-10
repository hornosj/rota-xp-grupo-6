package br.com.rotaxp.copiloto.inteligencia.radar;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotaxp.copiloto.config.RssProps;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;

class RssConfigTest {

    @Nested
    @SpringBootTest
    class Desligado {
        @Autowired ApplicationContext ctx;

        @Test
        void porPadraoSoAsCuradasEntramNoRadar() {
            assertThat(ctx.getBeansOfType(FonteRss.class)).isEmpty();
            assertThat(ctx.getBeansOfType(FonteNoticias.class)).containsOnlyKeys("fonteCurada");
        }

        @Test
        void feedsReaisConfigurados() {
            RssProps p = ctx.getBean(RssProps.class);
            assertThat(p.feeds()).extracting(RssProps.Feed::nome).containsExactly("InfoMoney", "CNN Brasil", "Bloomberg Línea");
            assertThat(p.maxItensPorFeed()).isPositive();
        }
    }

    @Nested
    @SpringBootTest(properties = {"radar.rss.habilitado=true", "radar.processar-no-inicio=false"})
    class Ligado {
        @Autowired ApplicationContext ctx;

        @Test
        void fonteRssEntraJuntoComACurada() {
            assertThat(ctx.getBeansOfType(FonteNoticias.class)).hasSize(2);
            assertThat(ctx.getBeansOfType(FonteRss.class)).hasSize(1);
        }
    }
}
