package br.com.rotaxp.copiloto.analise;

import br.com.rotaxp.copiloto.analise.InterpretadorTaxa.TaxaEstimada;
import br.com.rotaxp.copiloto.config.DesagioProps;
import br.com.rotaxp.copiloto.demo.DataReferencia;
import br.com.rotaxp.copiloto.dominio.Emissor;
import br.com.rotaxp.copiloto.dominio.Excecoes.NaoEncontrado;
import br.com.rotaxp.copiloto.dominio.Excecoes.RequisicaoInvalida;
import br.com.rotaxp.copiloto.dominio.Instituicao;
import br.com.rotaxp.copiloto.dominio.PosicaoInvestimento;
import br.com.rotaxp.copiloto.dominio.SimulacaoDesagio.DesagioDetalhado;
import br.com.rotaxp.copiloto.dominio.SimulacaoDesagio.DesagioPedido;
import br.com.rotaxp.copiloto.dominio.SimulacaoDesagio.EntradaResolvida;
import br.com.rotaxp.copiloto.dominio.SimulacaoDesagio.PosicaoDesagio;
import br.com.rotaxp.copiloto.dominio.SimulacaoDesagio.PosicoesDesagio;
import br.com.rotaxp.copiloto.openfinance.DadosVisiveis;
import br.com.rotaxp.copiloto.openfinance.OpenFinanceGateway;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class DesagioPosicaoService {

    private static final BigDecimal LIMITE_TAXA = new BigDecimal("5");
    private static final BigDecimal LIMITE_PRAZO = new BigDecimal("50");

    private static final Comparator<PosicaoDesagio> ELEGIVEIS_PRIMEIRO =
            Comparator.comparing(PosicaoDesagio::elegivel).reversed()
                    .thenComparing(p -> p.vencimento() == null ? LocalDate.MAX : p.vencimento())
                    .thenComparing(PosicaoDesagio::valorAtual, Comparator.reverseOrder());

    private final OpenFinanceGateway gateway;
    private final DataReferencia dataReferencia;
    private final DesagioProps props;
    private final InterpretadorTaxa taxas;
    private final DesagioService desagio;

    public DesagioPosicaoService(OpenFinanceGateway gateway, DataReferencia dataReferencia, DesagioProps props,
                                 InterpretadorTaxa taxas, DesagioService desagio) {
        this.gateway = gateway;
        this.dataReferencia = dataReferencia;
        this.props = props;
        this.taxas = taxas;
        this.desagio = desagio;
    }

    public PosicoesDesagio posicoes(String clienteId) {
        DadosVisiveis dados = gateway.dados(clienteId);
        List<PosicaoDesagio> lista = dados.investimentos().stream()
                .map(p -> descrever(p, dados))
                .sorted(ELEGIVEIS_PRIMEIRO)
                .toList();
        return new PosicoesDesagio(clienteId, dados.cliente().nome(), dataReferencia.hoje(), taxas.premissas(), lista);
    }

    public DesagioDetalhado simular(DesagioPedido p) {
        if (p == null) throw new RequisicaoInvalida("Corpo da requisição ausente.");
        Origem origem = origem(p);
        BigDecimal valor = p.valorAtual() != null ? p.valorAtual() : origem.valor();
        BigDecimal prazo = p.prazoRestanteAnos() != null ? p.prazoRestanteAnos() : origem.prazo();
        BigDecimal taxaAntiga = p.taxaAntiga();

        List<String> avisos = new ArrayList<>();
        if (taxaAntiga == null && origem.taxa() != null) {
            taxaAntiga = BigDecimal.valueOf(anualArredondada(origem.taxa()));
            if (origem.taxa().dependeDePremissa()) avisos.add(avisoTaxaEstimada(origem));
        }

        validar(p, valor, taxaAntiga, prazo);
        EntradaResolvida entrada = new EntradaResolvida(origem.id(), origem.nome(), valor, taxaAntiga.doubleValue(),
                p.taxaNova().doubleValue(), prazo.doubleValue(), p.desagio(), p.precoVenda());
        return desagio.calcular(entrada, avisos);
    }

    private record Origem(String id, String nome, BigDecimal valor, BigDecimal prazo, TaxaEstimada taxa, String taxaTexto) {
        static final Origem MANUAL = new Origem(null, null, null, null, null, null);
    }

    private Origem origem(DesagioPedido p) {
        if (vazio(p.posicaoId())) return Origem.MANUAL;
        if (vazio(p.clienteId())) throw new RequisicaoInvalida("Informe clienteId junto com posicaoId.");
        PosicaoInvestimento pos = gateway.dados(p.clienteId()).investimentos().stream()
                .filter(i -> i.id().equals(p.posicaoId()))
                .findFirst()
                .orElseThrow(() -> new NaoEncontrado(
                        "Posição " + p.posicaoId() + " não encontrada para o cliente " + p.clienteId()));
        String motivo = motivoInelegibilidade(pos);
        if (motivo != null) throw new RequisicaoInvalida("Esta posição não permite simular deságio: " + motivo);
        return new Origem(pos.id(), pos.nome(), pos.valorAtual(), BigDecimal.valueOf(prazoAnos(pos.vencimento())),
                taxas.interpretar(pos.indexador(), pos.taxa()).orElse(null), pos.taxa());
    }

    private static String avisoTaxaEstimada(Origem o) {
        return "Taxa atual estimada (" + Texto.pct(anualArredondada(o.taxa())) + " a.a.) a partir de \"" + o.taxaTexto()
                + "\" (" + o.taxa().premissa() + "). Ajuste se souber a taxa efetiva.";
    }

    private static void validar(DesagioPedido p, BigDecimal valor, BigDecimal taxaAntiga, BigDecimal prazo) {
        List<String> erros = new ArrayList<>();
        if (valor == null || valor.signum() <= 0) erros.add("valorAtual deve ser maior que zero");
        exigirEntreZeroE(erros, taxaAntiga, LIMITE_TAXA,
                "taxaAntiga é obrigatória (fração a.a., ex.: 0.12)", "taxaAntiga deve estar entre 0 e 5 (fração a.a.)");
        exigirEntreZeroE(erros, p.taxaNova(), LIMITE_TAXA,
                "taxaNova é obrigatória (fração a.a., ex.: 0.14)", "taxaNova deve estar entre 0 e 5 (fração a.a.)");
        exigirEntreZeroE(erros, prazo, LIMITE_PRAZO,
                "prazoRestanteAnos é obrigatório", "prazoRestanteAnos deve estar entre 0 e 50");
        validarVenda(erros, p.desagio(), p.precoVenda(), valor);
        if (!erros.isEmpty()) throw new RequisicaoInvalida(String.join("; ", erros) + ".");
    }

    private static void exigirEntreZeroE(List<String> erros, BigDecimal v, BigDecimal max, String seAusente, String seFora) {
        if (v == null) erros.add(seAusente);
        else if (v.signum() <= 0 || v.compareTo(max) > 0) erros.add(seFora);
    }

    private static void validarVenda(List<String> erros, BigDecimal desagio, BigDecimal precoVenda, BigDecimal valor) {
        if ((desagio == null) == (precoVenda == null)) {
            erros.add("informe exatamente um entre desagio (fração 0–1) e precoVenda (R$)");
        } else if (desagio != null && (desagio.signum() < 0 || desagio.compareTo(BigDecimal.ONE) >= 0)) {
            erros.add("desagio deve estar entre 0 (inclusive) e 1 (exclusive)");
        } else if (precoVenda != null && (precoVenda.signum() <= 0 || (valor != null && precoVenda.compareTo(valor) > 0))) {
            erros.add("precoVenda deve ser maior que zero e não pode superar o valorAtual (ágio não é suportado)");
        }
    }

    private PosicaoDesagio descrever(PosicaoInvestimento p, DadosVisiveis dados) {
        String motivo = motivoInelegibilidade(p);
        Optional<TaxaEstimada> taxa = taxas.interpretar(p.indexador(), p.taxa());
        Instituicao inst = dados.instituicao(p.instituicaoId());
        Emissor emissor = dados.emissor(p.emissorId());
        Double prazo = p.vencimento() == null ? null : arredondar(prazoAnos(p.vencimento()), 4);
        return new PosicaoDesagio(p.id(), p.nome(), p.produto(), p.indexador(), p.instituicaoId(),
                inst == null ? null : inst.nome(), emissor == null ? null : emissor.nome(),
                Dinheiro.de(p.valorAplicado()), Dinheiro.de(p.valorAtual()), p.dataAplicacao(), p.vencimento(),
                prazo, p.taxa(), taxa.map(DesagioPosicaoService::anualArredondada).orElse(null),
                taxa.map(TaxaEstimada::dependeDePremissa).orElse(false), motivo == null, motivo);
    }

    private String motivoInelegibilidade(PosicaoInvestimento p) {
        if (!props.produtosElegiveis().contains(p.produto())) {
            return "produto sem marcação a mercado por taxa (fundos, ações, previdência e poupança não têm deságio)";
        }
        if (p.vencimento() == null) return "posição sem data de vencimento";
        if (!p.vencimento().isAfter(dataReferencia.hoje())) return "título já vencido";
        if (p.liquidezDiaria()) return "liquidez diária: o resgate é feito sem deságio";
        return null;
    }

    private double prazoAnos(LocalDate vencimento) {
        return ChronoUnit.DAYS.between(dataReferencia.hoje(), vencimento) / (double) props.diasPorAno();
    }

    private static double anualArredondada(TaxaEstimada t) {
        return arredondar(t.anual(), 6);
    }

    private static double arredondar(double x, int casas) {
        return BigDecimal.valueOf(x).setScale(casas, RoundingMode.HALF_EVEN).doubleValue();
    }

    private static boolean vazio(String s) { return s == null || s.isBlank(); }
}
