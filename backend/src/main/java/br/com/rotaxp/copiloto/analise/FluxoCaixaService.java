package br.com.rotaxp.copiloto.analise;

import br.com.rotaxp.copiloto.config.RendaProps;
import br.com.rotaxp.copiloto.dominio.Conta;
import br.com.rotaxp.copiloto.dominio.Enums.Escopo;
import br.com.rotaxp.copiloto.dominio.FaturaCartao;
import br.com.rotaxp.copiloto.dominio.FluxoCaixa;
import br.com.rotaxp.copiloto.dominio.FluxoCaixa.FonteRenda;
import br.com.rotaxp.copiloto.dominio.Instituicao;
import br.com.rotaxp.copiloto.dominio.PosicaoInvestimento;
import br.com.rotaxp.copiloto.dominio.Transacao;
import br.com.rotaxp.copiloto.openfinance.DadosVisiveis;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import org.springframework.stereotype.Service;

/** PLAN §7.3. */
@Service
public class FluxoCaixaService {

    private final Categorizador categorizador;
    private final DetectorRenda detectorRenda;
    private final RendaProps props;

    public FluxoCaixaService(Categorizador categorizador, DetectorRenda detectorRenda, RendaProps props) {
        this.categorizador = categorizador;
        this.detectorRenda = detectorRenda;
        this.props = props;
    }

    public AnaliseFluxo calcular(DadosVisiveis d, LocalDate ref) {
        Janela janela = Janela.ultimosMeses(ref, props.mesesJanelaCusto());
        Map<String, BigDecimal> custo = new LinkedHashMap<>();
        TreeSet<String> cartoesProxy = new TreeSet<>();

        for (Transacao t : d.transacoes()) {
            if (!janela.contem(t.data())) continue;
            switch (categorizador.categorizar(t, d.cliente().cpf())) {
                case CONTA_RECORRENTE -> custo.merge("CONTAS_RECORRENTES", t.valor(), BigDecimal::add);
                case PARCELA_CREDITO -> custo.merge("PARCELAS", t.valor(), BigDecimal::add);
                case CONSUMO -> custo.merge("CONSUMO", t.valor(), BigDecimal::add);
                case PAGAMENTO_FATURA -> {
                    String banco = categorizador.bancoDaFatura(t.descricao(), d.todasInstituicoes());
                    if (banco == null || !d.visivel(banco, Escopo.CARTOES)) {
                        custo.merge("CARTOES", t.valor(), BigDecimal::add);
                        cartoesProxy.add(banco == null ? "cartão não identificado" : nome(d, banco));
                    }
                }
                default -> { }
            }
        }
        for (FaturaCartao f : d.faturas()) {
            if (janela.contem(f.mesReferencia())) custo.merge("CARTOES", f.valorTotal(), BigDecimal::add);
        }

        BigDecimal meses = BigDecimal.valueOf(janela.meses());
        Map<String, BigDecimal> custoMensal = new LinkedHashMap<>();
        custo.forEach((k, v) -> custoMensal.put(k, v.divide(meses, 2, RoundingMode.HALF_EVEN)));
        BigDecimal custoVida = Dinheiro.de(custoMensal.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add));

        List<FonteRenda> fontes = detectorRenda.detectar(d, ref);
        BigDecimal renda = Dinheiro.de(fontes.stream().map(FonteRenda::valorMensal).reduce(BigDecimal.ZERO, BigDecimal::add));
        BigDecimal saldoContas = Dinheiro.de(d.contas().stream().map(Conta::saldo).reduce(BigDecimal.ZERO, BigDecimal::add));
        BigDecimal liquidez = Dinheiro.de(saldoContas.add(d.investimentos().stream()
                .filter(PosicaoInvestimento::liquidezDiaria).map(PosicaoInvestimento::valorAtual)
                .reduce(BigDecimal.ZERO, BigDecimal::add)));
        double reserva = custoVida.signum() == 0 ? 0.0
                : liquidez.divide(custoVida, 1, RoundingMode.HALF_EVEN).doubleValue();

        boolean parcial = !cartoesProxy.isEmpty() || custoVida.signum() == 0;
        String observacao = custoVida.signum() == 0 ? "Sem gastos visíveis nos últimos " + janela.meses() + " meses."
                : !cartoesProxy.isEmpty()
                ? "Custo de vida estimado: o cartão " + String.join(", ", cartoesProxy)
                  + " não está conectado, então usamos o pagamento da fatura como aproximação."
                : null;

        FluxoCaixa fluxo = new FluxoCaixa(renda, fontes, custoVida, Dinheiro.de(renda.subtract(custoVida)),
                liquidez, reserva, parcial, observacao);
        return new AnaliseFluxo(fluxo, saldoContas, custoMensal);
    }

    private static String nome(DadosVisiveis d, String instituicaoId) {
        Instituicao i = d.instituicao(instituicaoId);
        return i == null ? instituicaoId : i.nome();
    }
}
