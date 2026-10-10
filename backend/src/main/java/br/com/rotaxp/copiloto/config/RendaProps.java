package br.com.rotaxp.copiloto.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("renda")
public record RendaProps(int mesesMinimos, double toleranciaValor, int mesesJanela, int mesesJanelaCusto) {}
