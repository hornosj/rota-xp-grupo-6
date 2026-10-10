package br.com.rotaxp.copiloto.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Limites da edição do cadastro por voz: o que a regra aceita antes de propor ou gravar uma mudança. */
@ConfigurationProperties("edicao")
public record EdicaoProps(int idadeMinima, int idadeMaxima, int maxCaracteresCampo, int maxCaracteresTranscricao) {}
