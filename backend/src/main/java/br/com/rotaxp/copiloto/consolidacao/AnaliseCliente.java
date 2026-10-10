package br.com.rotaxp.copiloto.consolidacao;

import br.com.rotaxp.copiloto.analise.AnaliseFgc;
import br.com.rotaxp.copiloto.analise.AnaliseFluxo;
import br.com.rotaxp.copiloto.analise.ResultadoPrioridade;
import br.com.rotaxp.copiloto.dominio.AcaoSugerida;
import br.com.rotaxp.copiloto.dominio.Alerta;
import br.com.rotaxp.copiloto.dominio.Cobertura;
import br.com.rotaxp.copiloto.dominio.Patrimonio;
import br.com.rotaxp.copiloto.dominio.Principalidade;
import br.com.rotaxp.copiloto.openfinance.DadosVisiveis;
import java.util.List;

/**
 * Análise completa de um cliente. A {@link Base} é cacheada por cliente; os alertas marcados
 * (novo/detectadoEm) são recalculados a cada leitura.
 */
public record AnaliseCliente(Base base, List<Alerta> alertas) {

    public record Base(
            DadosVisiveis dados, AnaliseFluxo fluxo, AnaliseFgc fgc, Principalidade principalidade,
            Cobertura cobertura, Patrimonio patrimonio, List<Alerta> alertas,
            ResultadoPrioridade prioridade, List<AcaoSugerida> acoes) {}

    public ResultadoPrioridade prioridade() { return base.prioridade(); }

    public List<AcaoSugerida> acoes() { return base.acoes(); }

    public Principalidade principalidade() { return base.principalidade(); }

    public DadosVisiveis dados() { return base.dados(); }

    public boolean temAlertaNovo() { return alertas.stream().anyMatch(Alerta::novo); }
}
