package br.com.rotaxp.copiloto.analise;

import br.com.rotaxp.copiloto.dominio.Requisicoes.DesagioBody;
import br.com.rotaxp.copiloto.dominio.Requisicoes.DesagioResultado;
import br.com.rotaxp.copiloto.dominio.SimulacaoDesagio.DesagioDetalhado;
import br.com.rotaxp.copiloto.dominio.SimulacaoDesagio.EntradaResolvida;
import br.com.rotaxp.copiloto.dominio.SimulacaoDesagio.EntradaUsada;
import br.com.rotaxp.copiloto.dominio.SimulacaoDesagio.PontoSerie;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class DesagioService {

    static final List<String> PREMISSAS = List.of(
            "Ignora IR, IOF e custos de corretagem.",
            "Supõe risco de crédito equivalente entre o título atual e o novo.",
            "Reinveste o valor da venda à taxa nova, constante, até o vencimento do título atual.",
            "Taxas efetivas ao ano, com capitalização composta.");

    private static final String RESSALVA = "Simulação simplificada: ignora IR e supõe risco equivalente entre os títulos.";

    public DesagioResultado simular(DesagioBody b) {
        double d = b.desagio().doubleValue();
        double antiga = b.taxaAntiga().doubleValue();
        double nova = b.taxaNova().doubleValue();
        double prazo = b.prazoRestanteAnos().doubleValue();
        if (d <= 0 || d >= 1 || nova <= antiga) {
            return new DesagioResultado(0, false, "Só compensa vender com deságio se a nova taxa for maior que a antiga "
                    + "e o deságio estiver entre 0% e 100%.");
        }
        double t = anosAteRecuperar(d, antiga, nova);
        double anos = arredondar(t, 1);
        boolean compensa = t < prazo;
        String explicacao = "Com deságio de " + Texto.pct(d) + ", trocar " + Texto.pct(antiga) + " a.a. por " + Texto.pct(nova)
                + " a.a. recupera a perda em " + Texto.decimal(anos) + " ano(s). Como faltam " + Texto.decimal(prazo)
                + " ano(s) para o vencimento, " + (compensa ? "a troca compensa" : "a troca não compensa") + ". " + RESSALVA;
        return new DesagioResultado(anos, compensa, explicacao);
    }

    public DesagioDetalhado calcular(EntradaResolvida e, List<String> avisos) {
        BigDecimal valor = Dinheiro.de(e.valorAtual());
        double ra = e.taxaAntiga();
        double rn = e.taxaNova();
        double prazo = e.prazoRestanteAnos();

        BigDecimal preco = e.precoVenda() != null
                ? Dinheiro.de(e.precoVenda())
                : Dinheiro.de(valor.multiply(BigDecimal.ONE.subtract(e.desagio())));
        double d = e.precoVenda() != null
                ? BigDecimal.ONE.subtract(preco.divide(valor, 6, RoundingMode.HALF_EVEN)).doubleValue()
                : e.desagio().doubleValue();

        BigDecimal manter = projetar(valor, ra, prazo);
        BigDecimal vender = projetar(preco, rn, prazo);
        BigDecimal ganho = vender.subtract(manter);
        BigDecimal perda = valor.subtract(preco);
        BreakEven be = rn > ra ? BreakEven.de(d, ra, rn, prazo, valor) : BreakEven.NUNCA;

        EntradaUsada usada = new EntradaUsada(e.posicaoId(), e.posicaoNome(), valor, ra, rn, prazo, arredondar(d, 6), preco);
        return new DesagioDetalhado(usada, perda, manter, vender, ganho, Dinheiro.fracao(ganho, manter),
                be.anos(), be.meses(), be.compensa(), be.desagioMaximo(), be.precoMinimo(),
                arredondar(rn - ra, 6), serie(valor, preco, ra, rn, prazo),
                explicar(usada, perda, manter, vender, ganho, be), PREMISSAS, List.copyOf(avisos));
    }

    private record BreakEven(Double anos, Integer meses, boolean compensa, Double desagioMaximo, BigDecimal precoMinimo) {

        static final BreakEven NUNCA = new BreakEven(null, null, false, null, null);

        static BreakEven de(double d, double ra, double rn, double prazo, BigDecimal valor) {
            double t = d <= 0 ? 0 : anosAteRecuperar(d, ra, rn);
            double dmax = 1 - Math.pow((1 + ra) / (1 + rn), prazo);
            return new BreakEven(arredondar(t, 2), (int) Math.round(t * 12), t < prazo, arredondar(dmax, 6),
                    Dinheiro.de(valor.multiply(BigDecimal.valueOf(1 - dmax))));
        }
    }

    private static double anosAteRecuperar(double d, double ra, double rn) {
        return Math.log(1 / (1 - d)) / Math.log((1 + rn) / (1 + ra));
    }

    private static BigDecimal projetar(BigDecimal valor, double taxa, double anos) {
        return Dinheiro.de(BigDecimal.valueOf(valor.doubleValue() * Math.pow(1 + taxa, anos)));
    }

    private static List<PontoSerie> serie(BigDecimal valor, BigDecimal preco, double ra, double rn, double prazo) {
        List<PontoSerie> pontos = new ArrayList<>();
        int meses = (int) Math.floor(prazo * 12);
        for (int m = 0; m <= meses; m++) pontos.add(ponto(m, m / 12.0, valor, preco, ra, rn));
        if (meses / 12.0 < prazo - 1e-9) pontos.add(ponto(meses + 1, prazo, valor, preco, ra, rn));
        return pontos;
    }

    private static PontoSerie ponto(int mes, double anos, BigDecimal valor, BigDecimal preco, double ra, double rn) {
        BigDecimal manter = projetar(valor, ra, anos);
        BigDecimal vender = projetar(preco, rn, anos);
        return new PontoSerie(mes, arredondar(anos, 4), manter, vender, vender.subtract(manter));
    }

    private static String explicar(EntradaUsada u, BigDecimal perda, BigDecimal manter, BigDecimal vender,
                                   BigDecimal ganho, BreakEven be) {
        List<String> frases = new ArrayList<>();
        frases.add(frasePerda(u, perda));
        if (be.anos() == null) {
            frases.add(fraseSemRecuperacao(u, ganho));
        } else {
            frases.add(fraseRecuperacao(u, be));
            frases.add(fraseResultado(u, manter, vender, ganho, be));
            frases.add("O deságio máximo que ainda compensa é de %s.".formatted(Texto.pct(be.desagioMaximo())));
        }
        frases.add(RESSALVA);
        return String.join(" ", frases);
    }

    private static String frasePerda(EntradaUsada u, BigDecimal perda) {
        String titulo = u.posicaoNome() == null ? "o título" : u.posicaoNome();
        return "Vender %s com deságio de %s gera uma perda imediata de %s (recebe %s)."
                .formatted(titulo, Texto.pct(u.desagio()), Texto.reaisCompletos(perda), Texto.reaisCompletos(u.precoVenda()));
    }

    private static String fraseSemRecuperacao(EntradaUsada u, BigDecimal ganho) {
        return ("Como a nova taxa (%s a.a.) não supera a atual (%s a.a.), a perda nunca é recuperada: "
                + "no vencimento o cliente ficaria com %s a menos.")
                .formatted(Texto.pct(u.taxaNova()), Texto.pct(u.taxaAntiga()), Texto.reaisCompletos(ganho.abs()));
    }

    private static String fraseRecuperacao(EntradaUsada u, BreakEven be) {
        return "Trocar %s a.a. por %s a.a. recupera a perda em %s ano(s) (cerca de %d meses)."
                .formatted(Texto.pct(u.taxaAntiga()), Texto.pct(u.taxaNova()), Texto.decimal(be.anos()), be.meses());
    }

    private static String fraseResultado(EntradaUsada u, BigDecimal manter, BigDecimal vender, BigDecimal ganho,
                                         BreakEven be) {
        String veredito = be.compensa() ? "compensa" : "não compensa";
        String sinal = ganho.signum() >= 0 ? "+" : "−";
        return ("Como faltam %s ano(s) para o vencimento, a troca %s: no vencimento o cliente terá %s "
                + "contra %s mantendo o título (%s%s).")
                .formatted(Texto.decimal(u.prazoRestanteAnos()), veredito, Texto.reaisCompletos(vender),
                        Texto.reaisCompletos(manter), sinal, Texto.reaisCompletos(ganho.abs()));
    }

    private static double arredondar(double x, int casas) {
        return BigDecimal.valueOf(x).setScale(casas, RoundingMode.HALF_EVEN).doubleValue();
    }
}
