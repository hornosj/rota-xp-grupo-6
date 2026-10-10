package br.com.rotaxp.copiloto.support;

import br.com.rotaxp.copiloto.analise.AlertaService;
import br.com.rotaxp.copiloto.analise.AnaliseFgc;
import br.com.rotaxp.copiloto.analise.AnaliseFluxo;
import br.com.rotaxp.copiloto.analise.Categorizador;
import br.com.rotaxp.copiloto.analise.DetectorRenda;
import br.com.rotaxp.copiloto.analise.FgcService;
import br.com.rotaxp.copiloto.analise.FluxoCaixaService;
import br.com.rotaxp.copiloto.analise.PrincipalidadeService;
import br.com.rotaxp.copiloto.analise.PrioridadeService;
import br.com.rotaxp.copiloto.analise.ResultadoPrioridade;
import br.com.rotaxp.copiloto.config.AlertasProps;
import br.com.rotaxp.copiloto.config.Premissas;
import br.com.rotaxp.copiloto.config.PrincipalidadeProps;
import br.com.rotaxp.copiloto.config.PrioridadeProps;
import br.com.rotaxp.copiloto.config.RendaProps;
import br.com.rotaxp.copiloto.consolidacao.CoberturaService;
import br.com.rotaxp.copiloto.consolidacao.PatrimonioService;
import br.com.rotaxp.copiloto.dominio.Alerta;
import br.com.rotaxp.copiloto.dominio.Cobertura;
import br.com.rotaxp.copiloto.dominio.Principalidade;
import br.com.rotaxp.copiloto.openfinance.DadosVisiveis;
import java.math.BigDecimal;
import java.util.List;

/** Todos os serviços de análise montados à mão, com os parâmetros do application.yml. */
public final class Pilha {

    public static final RendaProps RENDA = new RendaProps(3, 0.15, 6, 3);
    public static final Premissas PREMISSAS =
            new Premissas(new BigDecimal("0.10"), new Premissas.Fgc(new BigDecimal("250000"), new BigDecimal("1000000")));
    public static final AlertasProps ALERTAS = new AlertasProps(
            BigDecimal.ONE, new BigDecimal("10000"), new BigDecimal("2000"), 0.20, 0.35, 30, 15, 7, 6, new BigDecimal("0.5"));
    public static final PrincipalidadeProps PRINCIPALIDADE =
            new PrincipalidadeProps(new PrincipalidadeProps.Pesos(0.30, 0.20, 0.15, 0.15, 0.10, 0.10), 40);
    public static final PrioridadeProps PRIORIDADE = new PrioridadeProps(35, 1, 25, 10, 15, 10, 15, 1, 10, 10, 1, 10, 10, 10, 8, 8, 5);

    public final Categorizador categorizador = new Categorizador();
    public final DetectorRenda detectorRenda = new DetectorRenda(categorizador, RENDA);
    public final FluxoCaixaService fluxo = new FluxoCaixaService(categorizador, detectorRenda, RENDA);
    public final PrincipalidadeService principalidade = new PrincipalidadeService(categorizador, detectorRenda, RENDA, PRINCIPALIDADE);
    public final FgcService fgc = new FgcService(PREMISSAS);
    public final AlertaService alertas = new AlertaService(ALERTAS, PREMISSAS);
    public final PrioridadeService prioridade = new PrioridadeService(PRIORIDADE);
    public final PatrimonioService patrimonio = new PatrimonioService();
    public final CoberturaService cobertura = new CoberturaService();

    /** Resultado completo da análise de um cliente (sem registro de alertas). */
    public record Analise(DadosVisiveis dados, AnaliseFluxo fluxo, AnaliseFgc fgc, Principalidade principalidade,
                          List<Alerta> alertas, ResultadoPrioridade prioridade, Cobertura cobertura) {}

    /** Assembler completo sobre a infraestrutura dada, já com a linha de base de alertas registrada. */
    public br.com.rotaxp.copiloto.consolidacao.Visao360Assembler assembler(Infra i) {
        var registro = new br.com.rotaxp.copiloto.demo.RegistroAlertas(i.dataReferencia, Infra.demoProps());
        var a = new br.com.rotaxp.copiloto.consolidacao.Visao360Assembler(i.gateway, i.repo, i.dataReferencia, registro,
                fluxo, principalidade, fgc, alertas, prioridade, patrimonio, cobertura,
                new br.com.rotaxp.copiloto.inteligencia.AcaoSugeridaService(ALERTAS, PREMISSAS), i.consentimentos);
        a.registrarLinhaDeBase();
        return a;
    }

    public Analise analisar(DadosVisiveis d) {
        AnaliseFluxo f = fluxo.calcular(d, CenarioBuilder.REF);
        AnaliseFgc g = fgc.calcular(d);
        Principalidade p = principalidade.calcular(d, CenarioBuilder.REF);
        List<Alerta> a = alertas.detectar(d, CenarioBuilder.REF, f, g);
        return new Analise(d, f, g, p, a, prioridade.calcular(a, p.posicaoXp()), cobertura.calcular(d));
    }
}
