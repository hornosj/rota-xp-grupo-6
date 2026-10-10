package br.com.rotaxp.copiloto.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("consentimento")
public record ConsentimentoProps(int prazoDias) {}
