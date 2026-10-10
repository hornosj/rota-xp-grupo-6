package br.com.rotaxp.copiloto.analise;

import br.com.rotaxp.copiloto.config.RentabilidadeProps;
import br.com.rotaxp.copiloto.dominio.Excecoes.RequisicaoInvalida;
import br.com.rotaxp.copiloto.dominio.SimulacaoRentabilidade.PeriodoRentabilidade;
import br.com.rotaxp.copiloto.dominio.SimulacaoRentabilidade.PontoRentabilidade;
import br.com.rotaxp.copiloto.dominio.SimulacaoRentabilidade.RentabilidadePedido;
import br.com.rotaxp.copiloto.dominio.SimulacaoRentabilidade.RentabilidadeResultado;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class RentabilidadeService {

    static final List<String> PREMISSAS = List.of(
            "Cada período tem um retorno único e o aporte entra ao final dele, depois do retorno.",
            "O ganho em R$ compara o valor final com tudo o que foi aportado e depende de quando e quanto se aportou.",
            "O TWR (retorno ponderado pelo tempo) isola o desempenho do investimento do momento e do tamanho dos aportes.",
            "Ignora IR, IOF e custos.");

    private static final String RESSALVA = "Rentabilidade passada não garante resultado futuro.";
    private static final MathContext PRECISAO = MathContext.DECIMAL128;

    private final RentabilidadeProps props;

    public RentabilidadeService(RentabilidadeProps props) {
        this.props = props;
    }

    public RentabilidadeResultado simular(RentabilidadePedido p) {
        if (p == null) throw new RequisicaoInvalida("Corpo da requisição ausente.");
        validar(p);
        return calcular(p.valorInicial(), p.periodos());
    }

    private RentabilidadeResultado calcular(BigDecimal inicial, List<PeriodoRentabilidade> periodos) {
        BigDecimal valor = inicial;
        BigDecimal aportado = inicial;
        BigDecimal fatorTwr = BigDecimal.ONE;
        List<PontoRentabilidade> pontos = new ArrayList<>();

        for (int i = 0; i < periodos.size(); i++) {
            PeriodoRentabilidade per = periodos.get(i);
            BigDecimal aporte = per.aporte() == null ? BigDecimal.ZERO : per.aporte();
            BigDecimal antesDoAporte = valor.multiply(BigDecimal.ONE.add(per.retorno()), PRECISAO);
            BigDecimal depois = antesDoAporte.add(aporte);
            fatorTwr = fatorTwr.multiply(BigDecimal.ONE.add(per.retorno()), PRECISAO);
            pontos.add(new PontoRentabilidade(i + 1, Dinheiro.de(valor), per.retorno().doubleValue(),
                    Dinheiro.de(antesDoAporte), Dinheiro.de(aporte), Dinheiro.de(depois), fracao(fatorTwr.subtract(BigDecimal.ONE))));
            valor = depois;
            aportado = aportado.add(aporte);
        }

        BigDecimal ganho = valor.subtract(aportado);
        double ganhoPct = aportado.signum() == 0 ? 0 : fracao(ganho.divide(aportado, PRECISAO));
        double twr = fracao(fatorTwr.subtract(BigDecimal.ONE));
        return new RentabilidadeResultado(Dinheiro.de(inicial), Dinheiro.de(aportado), Dinheiro.de(valor),
                Dinheiro.de(ganho), ganhoPct, twr, pontos,
                explicar(inicial, aportado, valor, ganho, ganhoPct, twr), PREMISSAS);
    }

    private static String explicar(BigDecimal inicial, BigDecimal aportado, BigDecimal valor, BigDecimal ganho,
                                   double ganhoPct, double twr) {
        BigDecimal aportes = aportado.subtract(inicial);
        String origem = aportes.signum() == 0
                ? "Com %s investidos".formatted(Texto.reaisCompletos(Dinheiro.de(inicial)))
                : "Com %s iniciais e %s em aportes (total aportado de %s)".formatted(
                        Texto.reaisCompletos(Dinheiro.de(inicial)), Texto.reaisCompletos(Dinheiro.de(aportes)),
                        Texto.reaisCompletos(Dinheiro.de(aportado)));
        String resultado = ganho.signum() >= 0 ? "ganho" : "perda";
        return ("%s, o valor chegou a %s: %s de %s (%s sobre o aportado). "
                + "O TWR, que isola o desempenho do investimento do momento e do tamanho dos aportes, foi de %s. %s")
                .formatted(origem, Texto.reaisCompletos(Dinheiro.de(valor)), resultado,
                        Texto.reaisCompletos(Dinheiro.de(ganho.abs())), Texto.pct(Math.abs(ganhoPct)),
                        Texto.pct(twr), RESSALVA);
    }

    private void validar(RentabilidadePedido p) {
        List<String> erros = new ArrayList<>();
        if (p.valorInicial() == null) erros.add("valorInicial é obrigatório");
        else if (p.valorInicial().signum() <= 0) erros.add("valorInicial deve ser maior que zero");

        List<PeriodoRentabilidade> periodos = p.periodos();
        if (periodos == null || periodos.isEmpty()) {
            erros.add("periodos deve ter ao menos um período");
        } else if (periodos.size() > props.maxPeriodos()) {
            erros.add("periodos deve ter no máximo " + props.maxPeriodos() + " períodos");
        } else {
            for (int i = 0; i < periodos.size(); i++) validarPeriodo(erros, periodos.get(i), i + 1);
        }
        if (!erros.isEmpty()) throw new RequisicaoInvalida(String.join("; ", erros) + ".");
    }

    private static void validarPeriodo(List<String> erros, PeriodoRentabilidade per, int numero) {
        if (per == null || per.retorno() == null) {
            erros.add("retorno do período " + numero + " é obrigatório (fração, ex.: 0.20)");
        } else if (per.retorno().compareTo(BigDecimal.ONE.negate()) <= 0) {
            erros.add("retorno do período " + numero + " deve ser maior que -1 (−100%)");
        }
        if (per != null && per.aporte() != null && per.aporte().signum() < 0) {
            erros.add("aporte do período " + numero + " não pode ser negativo");
        }
    }

    private static double fracao(BigDecimal x) {
        return x.setScale(6, RoundingMode.HALF_EVEN).doubleValue();
    }
}
