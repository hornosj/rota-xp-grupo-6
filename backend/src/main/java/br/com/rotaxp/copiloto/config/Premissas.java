package br.com.rotaxp.copiloto.config;

import java.math.BigDecimal;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("premissas")
public record Premissas(BigDecimal cdiAnual, Fgc fgc) {
    public record Fgc(BigDecimal limitePorConglomerado, BigDecimal tetoGlobal) {}
}
