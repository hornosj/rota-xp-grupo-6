package br.com.rotaxp.copiloto.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("rentabilidade")
public record RentabilidadeProps(int maxPeriodos) {}
