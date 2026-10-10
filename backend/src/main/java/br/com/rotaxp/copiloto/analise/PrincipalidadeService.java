package br.com.rotaxp.copiloto.analise;

import br.com.rotaxp.copiloto.config.PrincipalidadeProps;
import br.com.rotaxp.copiloto.config.PrincipalidadeProps.Pesos;
import br.com.rotaxp.copiloto.config.RendaProps;
import br.com.rotaxp.copiloto.dominio.Conta;
import br.com.rotaxp.copiloto.dominio.Enums.PosicaoXp;
import br.com.rotaxp.copiloto.dominio.FaturaCartao;
import br.com.rotaxp.copiloto.dominio.FluxoCaixa.FonteRenda;
import br.com.rotaxp.copiloto.dominio.Instituicao;
import br.com.rotaxp.copiloto.dominio.OperacaoCredito;
import br.com.rotaxp.copiloto.dominio.PosicaoInvestimento;
import br.com.rotaxp.copiloto.dominio.Principalidade;
import br.com.rotaxp.copiloto.dominio.ScoreInstituicao;
import br.com.rotaxp.copiloto.dominio.ScoreInstituicao.Componentes;
import br.com.rotaxp.copiloto.dominio.Transacao;
import br.com.rotaxp.copiloto.dominio.Enums.TipoTransacao;
import br.com.rotaxp.copiloto.openfinance.DadosVisiveis;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** PLAN §7.4 — scorecard de principalidade por instituição visível. */
@Service
public class PrincipalidadeService {

    enum Comp { RENDA, MOVIMENTACAO, CONTAS_RECORRENTES, INVESTIMENTOS, CARTAO, CREDITO }

    /** Ordem de preferência dos destaques citados na explicação. */
    private static final List<Comp> ORDEM_EXPLICACAO = List.of(
            Comp.RENDA, Comp.CONTAS_RECORRENTES, Comp.CREDITO, Comp.CARTAO, Comp.INVESTIMENTOS, Comp.MOVIMENTACAO);

    private final Categorizador categorizador;
    private final DetectorRenda detectorRenda;
    private final RendaProps rendaProps;
    private final PrincipalidadeProps props;

    public PrincipalidadeService(Categorizador categorizador, DetectorRenda detectorRenda, RendaProps rendaProps,
                                 PrincipalidadeProps props) {
        this.categorizador = categorizador;
        this.detectorRenda = detectorRenda;
        this.rendaProps = rendaProps;
        this.props = props;
    }

    public Principalidade calcular(DadosVisiveis d, LocalDate ref) {
        Map<Comp, Map<String, BigDecimal>> numeradores = numeradores(d, ref);
        Map<Comp, BigDecimal> totais = new EnumMap<>(Comp.class);
        numeradores.forEach((c, m) -> totais.put(c, m.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add)));

        double somaPesos = 0;
        for (Comp c : Comp.values()) if (totais.get(c).signum() > 0) somaPesos += peso(c);

        List<ScoreInstituicao> scores = new ArrayList<>();
        for (Instituicao inst : d.instituicoesVisiveis().values()) {
            Map<Comp, Double> part = new EnumMap<>(Comp.class);
            Map<Comp, Double> contrib = new EnumMap<>(Comp.class);
            double score = 0;
            for (Comp c : Comp.values()) {
                double p = Dinheiro.fracao(numeradores.get(c).getOrDefault(inst.id(), BigDecimal.ZERO), totais.get(c));
                double pontos = somaPesos == 0 ? 0 : 100 * peso(c) * p / somaPesos;
                part.put(c, arred(p, 4));
                contrib.put(c, arred(pontos, 1));
                score += pontos;
            }
            scores.add(new ScoreInstituicao(inst.id(), inst.nome(), inst.ehXp(), arred(score, 1),
                    componentes(part), componentes(contrib), destaques(part)));
        }
        scores.sort(Comparator.comparingDouble(ScoreInstituicao::score)
                .thenComparingDouble(s -> s.participacoes().renda()).reversed());

        ScoreInstituicao principal = scores.isEmpty() ? null : scores.get(0);
        ScoreInstituicao xp = scores.stream().filter(ScoreInstituicao::ehXp).findFirst().orElse(null);
        PosicaoXp posicao = posicaoXp(xp, principal);
        return new Principalidade(
                principal == null ? null : principal.instituicaoId(),
                principal == null ? null : principal.nome(),
                posicao, explicacao(principal, xp, posicao), scores);
    }

    private Map<Comp, Map<String, BigDecimal>> numeradores(DadosVisiveis d, LocalDate ref) {
        Map<Comp, Map<String, BigDecimal>> n = new EnumMap<>(Comp.class);
        for (Comp c : Comp.values()) n.put(c, new HashMap<>());

        for (FonteRenda f : detectorRenda.detectar(d, ref)) {
            if (f.instituicaoId() != null) n.get(Comp.RENDA).merge(f.instituicaoId(), f.valorMensal(), BigDecimal::add);
        }
        Janela janela = Janela.ultimosMeses(ref, rendaProps.mesesJanelaCusto());
        for (Transacao t : d.transacoes()) {
            if (!janela.contem(t.data()) || t.tipo() != TipoTransacao.DEBITO) continue;
            Conta conta = d.conta(t.contaId());
            if (conta == null) continue;
            Categoria cat = categorizador.categorizar(t, d.cliente().cpf());
            if (cat != Categoria.TRANSFERENCIA_PROPRIA && cat != Categoria.APLICACAO) {
                n.get(Comp.MOVIMENTACAO).merge(conta.instituicaoId(), t.valor(), BigDecimal::add);
            }
            if (cat == Categoria.CONTA_RECORRENTE || cat == Categoria.PARCELA_CREDITO) {
                n.get(Comp.CONTAS_RECORRENTES).merge(conta.instituicaoId(), t.valor(), BigDecimal::add);
            }
        }
        for (PosicaoInvestimento p : d.investimentos()) {
            n.get(Comp.INVESTIMENTOS).merge(p.instituicaoId(), p.valorAtual(), BigDecimal::add);
        }
        for (FaturaCartao f : d.faturas()) {
            if (janela.contem(f.mesReferencia())) n.get(Comp.CARTAO).merge(f.instituicaoId(), f.valorTotal(), BigDecimal::add);
        }
        for (OperacaoCredito c : d.creditos()) {
            n.get(Comp.CREDITO).merge(c.instituicaoId(), c.saldoDevedor(), BigDecimal::add);
        }
        return n;
    }

    private PosicaoXp posicaoXp(ScoreInstituicao xp, ScoreInstituicao principal) {
        if (xp == null) return PosicaoXp.AUSENTE;
        Componentes p = xp.participacoes();
        boolean foraInvestimentos = p.renda() > 0 || p.movimentacao() > 0 || p.contasRecorrentes() > 0
                || p.cartao() > 0 || p.credito() > 0;
        if (!foraInvestimentos) return p.investimentos() > 0 ? PosicaoXp.SO_INVESTIMENTOS : PosicaoXp.AUSENTE;
        if (xp == principal && xp.score() >= props.scoreMinimoPrincipal()) return PosicaoXp.PRINCIPAL;
        return PosicaoXp.SECUNDARIA;
    }

    private String explicacao(ScoreInstituicao principal, ScoreInstituicao xp, PosicaoXp posicao) {
        if (principal == null || principal.score() == 0) {
            return "Ainda não há dados suficientes para identificar a instituição principal.";
        }
        Map<Comp, Double> part = mapa(principal.participacoes());
        List<String> motivos = ORDEM_EXPLICACAO.stream().filter(c -> part.get(c) >= 0.5).limit(2)
                .map(c -> frase(c, part.get(c))).toList();
        String inicio = principal.nome() + " é a instituição principal"
                + (motivos.isEmpty() ? ", com " + pontos(principal.score()) + " pontos." : ": " + String.join(" e ", motivos) + ".");
        String sobreXp = switch (posicao) {
            case PRINCIPAL -> "";
            case SO_INVESTIMENTOS -> " A XP tem " + pontos(xp.score()) + " pontos: só investimentos.";
            case SECUNDARIA -> xp == principal
                    ? " A XP lidera com " + pontos(xp.score()) + " pontos, mas ainda abaixo de "
                      + pontos(props.scoreMinimoPrincipal()) + " para ser principal."
                    : " A XP tem " + pontos(xp.score()) + " pontos.";
            case AUSENTE -> " A XP ainda não aparece no dia a dia financeiro do cliente.";
        };
        return inicio + sobreXp;
    }

    private static List<String> destaques(Map<Comp, Double> part) {
        List<String> r = new ArrayList<>();
        for (Comp c : Comp.values()) if (part.get(c) >= 0.5) r.add(frase(c, part.get(c)));
        return r;
    }

    private static String frase(Comp c, double p) {
        String pct = Math.round(p * 100) + "%";
        return switch (c) {
            case RENDA -> "recebe " + pct + " da renda";
            case MOVIMENTACAO -> pct + " da movimentação";
            case CONTAS_RECORRENTES -> "concentra " + pct + " dos pagamentos recorrentes";
            case INVESTIMENTOS -> "custodia " + pct + " dos investimentos";
            case CARTAO -> pct + " das faturas de cartão";
            case CREDITO -> pct + " do crédito";
        };
    }

    private double peso(Comp c) {
        Pesos p = props.pesos();
        return switch (c) {
            case RENDA -> p.renda();
            case MOVIMENTACAO -> p.movimentacao();
            case CONTAS_RECORRENTES -> p.contasRecorrentes();
            case INVESTIMENTOS -> p.investimentos();
            case CARTAO -> p.cartao();
            case CREDITO -> p.credito();
        };
    }

    private static Componentes componentes(Map<Comp, Double> m) {
        return new Componentes(m.get(Comp.RENDA), m.get(Comp.MOVIMENTACAO), m.get(Comp.CONTAS_RECORRENTES),
                m.get(Comp.INVESTIMENTOS), m.get(Comp.CARTAO), m.get(Comp.CREDITO));
    }

    private static Map<Comp, Double> mapa(Componentes c) {
        Map<Comp, Double> m = new EnumMap<>(Comp.class);
        m.put(Comp.RENDA, c.renda());
        m.put(Comp.MOVIMENTACAO, c.movimentacao());
        m.put(Comp.CONTAS_RECORRENTES, c.contasRecorrentes());
        m.put(Comp.INVESTIMENTOS, c.investimentos());
        m.put(Comp.CARTAO, c.cartao());
        m.put(Comp.CREDITO, c.credito());
        return m;
    }

    static double arred(double v, int casas) {
        return BigDecimal.valueOf(v).setScale(casas, java.math.RoundingMode.HALF_EVEN).doubleValue();
    }

    private static String pontos(double v) {
        return v == Math.rint(v) ? String.valueOf((long) v) : String.valueOf(v).replace('.', ',');
    }
}
