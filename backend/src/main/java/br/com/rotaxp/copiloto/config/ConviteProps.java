package br.com.rotaxp.copiloto.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Convites de consentimento.
 *
 * @param linkBase      prefixo do link enviado ao cliente (a tela /convite/[token] do frontend)
 * @param validadeHoras quanto tempo o convite vale antes de expirar
 * @param prazoMeses    prazo do consentimento pedido no convite
 */
@ConfigurationProperties("convite")
public record ConviteProps(String linkBase, int validadeHoras, int prazoMeses) {}
