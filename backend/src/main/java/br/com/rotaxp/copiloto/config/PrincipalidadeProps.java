package br.com.rotaxp.copiloto.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("principalidade")
public record PrincipalidadeProps(Pesos pesos, double scoreMinimoPrincipal) {
    public record Pesos(double renda, double movimentacao, double contasRecorrentes,
                        double investimentos, double cartao, double credito) {}
}
