package br.com.rotaxp.copiloto.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Feeds RSS reais do radar (desligados por padrão: a demo usa as notícias curadas, offline). */
@ConfigurationProperties("radar.rss")
public record RssProps(boolean habilitado, int maxItensPorFeed, int timeoutSegundos, List<Feed> feeds) {
    public record Feed(String nome, String url) {}
}
