package br.com.rotaxp.copiloto.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("prioridade")
public record PrioridadeProps(
        double fgcBase, double fgcPor20k, double fgcMaxExtra, double fgcTetoGlobal,
        double concentracaoBase, double concentracaoAltaExtra,
        double vencimentoBase, double vencimentoPor50k, double vencimentoMaxExtra,
        double saldoParadoBase, double saldoParadoPor10k, double saldoParadoMaxExtra,
        double rendaFora, double consentimentoExpirando, double reservaInsuficiente,
        double eventoVida, double bonusSoInvestimentos) {}
