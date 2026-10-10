package br.com.rotaxp.copiloto.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param tipo            sqlite (padrão) | memoria
 * @param recriarNoInicio se true, reimporta a seed a cada startup; se false, só importa com o banco vazio
 */
@ConfigurationProperties("banco")
public record BancoProps(String tipo, boolean recriarNoInicio) {}
