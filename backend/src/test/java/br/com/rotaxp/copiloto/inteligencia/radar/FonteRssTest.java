package br.com.rotaxp.copiloto.inteligencia.radar;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.rotaxp.copiloto.config.RssProps;
import br.com.rotaxp.copiloto.dominio.Radar.Noticia;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class FonteRssTest {

    private static String exemplo() throws IOException {
        try (InputStream in = FonteRssTest.class.getResourceAsStream("/rss/exemplo.xml")) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    // ---------- leitor ----------

    @Test
    void leItensDoRss() throws Exception {
        List<NoticiaColetada> itens = LeitorRss.ler(exemplo(), "InfoMoney", 50);

        assertThat(itens).hasSize(2);
        Noticia n = itens.get(0).noticia();
        assertThat(n.fonte()).isEqualTo("InfoMoney");
        assertThat(n.titulo()).isEqualTo("Copom eleva a Selic e sinaliza novos ajustes");
        assertThat(n.url()).isEqualTo("https://exemplo.test/mercados/copom-eleva-selic/");
        assertThat(n.resumo()).isEqualTo("O comitê elevou a taxa básica de juros & indicou que pode subir mais. Leia mais");
        assertThat(n.publicadaEm()).isEqualTo(OffsetDateTime.parse("2026-10-10T15:53:27Z"));
        assertThat(n.id()).startsWith("rss-").hasSize(16);
        assertThat(itens.get(0).referencia()).isNull();   // sem gabarito: classifica por regra ou LLM
    }

    @Test
    void idEhEstavelPeloLinkOuGuid() throws Exception {
        List<NoticiaColetada> a = LeitorRss.ler(exemplo(), "InfoMoney", 50);
        List<NoticiaColetada> b = LeitorRss.ler(exemplo(), "Outro nome", 50);

        assertThat(a.get(0).noticia().id()).isEqualTo(b.get(0).noticia().id());
        assertThat(a.get(1).noticia().id()).isNotEqualTo(a.get(0).noticia().id());
        assertThat(a.get(1).noticia().url()).isEqualTo("https://exemplo.test/?p=123");
        assertThat(a.get(1).noticia().publicadaEm()).isEqualTo(OffsetDateTime.parse("2026-10-09T09:00:00-03:00"));
    }

    @Test
    void respeitaOLimiteDeItensPorFeed() throws Exception {
        assertThat(LeitorRss.ler(exemplo(), "f", 1)).hasSize(1);
    }

    @Test
    void recusaXmlComEntidadeExterna() {
        String xxe = """
                <?xml version="1.0"?>
                <!DOCTYPE rss [<!ENTITY segredo SYSTEM "file:///c:/windows/win.ini">]>
                <rss><channel><item><title>&segredo;</title><link>x</link></item></channel></rss>
                """;

        assertThatThrownBy(() -> LeitorRss.ler(xxe, "f", 50)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void recusaXmlMalformado() {
        assertThatThrownBy(() -> LeitorRss.ler("<rss><channel>", "f", 50)).isInstanceOf(IllegalArgumentException.class);
    }

    // ---------- fonte ----------

    @Test
    void fonteJuntaOsFeedsEIgnoraOQueFalha() throws Exception {
        String xml = exemplo();
        RssProps props = new RssProps(true, 50, 10, List.of(
                new RssProps.Feed("InfoMoney", "https://a.test/feed"),
                new RssProps.Feed("Fora do ar", "https://b.test/feed"),
                new RssProps.Feed("CNN Brasil", "https://c.test/feed")));
        Map<String, String> respostas = Map.of("https://a.test/feed", xml, "https://c.test/feed", xml);

        FonteRss fonte = new FonteRss(props, url -> {
            if (!respostas.containsKey(url)) throw new IOException("503");
            return respostas.get(url);
        });
        List<NoticiaColetada> r = fonte.coletar();

        assertThat(r).hasSize(4);
        assertThat(r).extracting(n -> n.noticia().fonte()).containsOnly("InfoMoney", "CNN Brasil");
    }
}
