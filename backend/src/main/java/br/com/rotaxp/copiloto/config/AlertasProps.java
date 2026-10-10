package br.com.rotaxp.copiloto.config;

import java.math.BigDecimal;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("alertas")
public record AlertasProps(
        BigDecimal saldoParadoMultiploCusto,
        BigDecimal saldoParadoMinimo,
        BigDecimal rendaForaCapacidadeMinima,
        double exposicaoSemGarantiaMax,
        double exposicaoSemGarantiaAlta,
        int vencimentoDias,
        int consentimentoExpirandoDias,
        int eventoVidaDias,
        double reservaMesesAlvo,
        BigDecimal aporteProgramadoFracaoSobra) {}
