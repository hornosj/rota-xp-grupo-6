package br.com.rotaxp.copiloto.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Onboarding do investidor. Os limites são a pontuação máxima (inclusive) de cada perfil no
 * questionário de suitability; acima do limite arrojado o perfil é AGRESSIVO.
 */
@ConfigurationProperties("onboarding")
public record OnboardingProps(String caminhoLink, int idadeMinima, Suitability suitability) {

    public record Suitability(int limiteConservador, int limiteModerado, int limiteArrojado) {}
}
