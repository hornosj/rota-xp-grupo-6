package br.com.rotaxp.copiloto.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Radar de notícias (BE2-10).
 *
 * @param classificacao       referencia (gabarito curado; demo offline) | regras | llm (lotes + queda nas regras)
 * @param modeloClassificacao modelo barato para classificar (via OpenRouter)
 * @param tamanhoLote         notícias por chamada ao LLM
 * @param cron                quando o worker roda (zona America/Sao_Paulo)
 * @param fracaoPlena         fração do patrimônio a partir da qual a exposição conta inteira nos pontos
 * @param pontosMinimos       abaixo disso o impacto não aparece
 * @param preFiltro           no modo llm, só manda ao LLM notícias em que as regras acham emissor, indexador ou
 *                            produto (feeds gerais têm ~90% de notícias sem nada financeiro)
 */
@ConfigurationProperties("radar")
public record RadarProps(String classificacao, String modeloClassificacao, int tamanhoLote, String cron,
                         boolean workerHabilitado, boolean processarNoInicio, double fracaoPlena, double pontosMinimos,
                         boolean preFiltro) {}
