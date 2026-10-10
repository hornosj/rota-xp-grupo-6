package br.com.rotaxp.copiloto.dominio;

import java.time.OffsetDateTime;
import java.util.List;

public record Visao360(
        Cliente cliente, OffsetDateTime atualizadoEm,
        Cobertura cobertura, Patrimonio patrimonio, Principalidade principalidade,
        FluxoCaixa fluxoCaixa, List<Alerta> alertas, List<AcaoSugerida> acoes,
        List<ConsentimentoView> consentimentos) {}
