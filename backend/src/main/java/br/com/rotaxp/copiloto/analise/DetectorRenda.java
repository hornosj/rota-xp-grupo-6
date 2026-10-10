package br.com.rotaxp.copiloto.analise;

import br.com.rotaxp.copiloto.config.RendaProps;
import br.com.rotaxp.copiloto.dominio.Conta;
import br.com.rotaxp.copiloto.dominio.FluxoCaixa.FonteRenda;
import br.com.rotaxp.copiloto.dominio.Transacao;
import br.com.rotaxp.copiloto.openfinance.DadosVisiveis;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * PLAN §7.2: créditos candidatos a renda agrupados por pagador; é renda recorrente se aparecer em
 * pelo menos N meses distintos da janela, com valores a ±tolerância da mediana.
 */
@Component
public class DetectorRenda {

    private final Categorizador categorizador;
    private final RendaProps props;

    public DetectorRenda(Categorizador categorizador, RendaProps props) {
        this.categorizador = categorizador;
        this.props = props;
    }

    public List<FonteRenda> detectar(DadosVisiveis d, LocalDate ref) {
        Janela janela = Janela.ultimosMeses(ref, props.mesesJanela());
        String cpf = d.cliente().cpf();
        Map<String, List<Transacao>> porPagador = new LinkedHashMap<>();
        for (Transacao t : d.transacoes()) {
            if (!janela.contem(t.data())) continue;
            if (categorizador.categorizar(t, cpf) != Categoria.CREDITO_CANDIDATO_RENDA) continue;
            String chave = t.contraparteDocumento() != null ? t.contraparteDocumento() : t.descricao();
            porPagador.computeIfAbsent(chave, k -> new ArrayList<>()).add(t);
        }

        List<FonteRenda> fontes = new ArrayList<>();
        for (List<Transacao> creditos : porPagador.values()) {
            BigDecimal mediana = mediana(creditos.stream().map(Transacao::valor).toList());
            BigDecimal tolerancia = mediana.multiply(BigDecimal.valueOf(props.toleranciaValor()));
            List<Transacao> dentro = creditos.stream()
                    .filter(t -> t.valor().subtract(mediana).abs().compareTo(tolerancia) <= 0).toList();
            long meses = dentro.stream().map(t -> YearMonth.from(t.data())).distinct().count();
            if (meses < props.mesesMinimos()) continue;

            Transacao exemplo = dentro.get(0);
            Conta conta = d.conta(exemplo.contaId());
            fontes.add(new FonteRenda(
                    pagador(exemplo),
                    conta == null ? null : conta.instituicaoId(),
                    Dinheiro.de(mediana(dentro.stream().map(Transacao::valor).toList())),
                    mediana(dentro.stream().map(t -> BigDecimal.valueOf(t.data().getDayOfMonth())).toList())
                            .setScale(0, RoundingMode.HALF_EVEN).intValue()));
        }
        fontes.sort(Comparator.comparing(FonteRenda::valorMensal).reversed());
        return fontes;
    }

    private static String pagador(Transacao t) {
        if (t.contraparteNome() != null && !t.contraparteNome().isBlank()) return t.contraparteNome();
        return t.descricao().replaceFirst("^(SALARIO|PRO LABORE)\\s+", "");
    }

    static BigDecimal mediana(List<BigDecimal> valores) {
        List<BigDecimal> ord = valores.stream().sorted().toList();
        int n = ord.size();
        if (n == 0) return BigDecimal.ZERO;
        return n % 2 == 1 ? ord.get(n / 2)
                : ord.get(n / 2 - 1).add(ord.get(n / 2)).divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_EVEN);
    }
}
