package br.com.rotaxp.copiloto.analise;

import br.com.rotaxp.copiloto.config.Premissas;
import br.com.rotaxp.copiloto.dominio.Conta;
import br.com.rotaxp.copiloto.dominio.Emissor;
import br.com.rotaxp.copiloto.dominio.Enums.Produto;
import br.com.rotaxp.copiloto.dominio.Enums.TipoConta;
import br.com.rotaxp.copiloto.dominio.Enums.TipoEmissor;
import br.com.rotaxp.copiloto.dominio.Instituicao;
import br.com.rotaxp.copiloto.dominio.PosicaoInvestimento;
import br.com.rotaxp.copiloto.openfinance.DadosVisiveis;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * PLAN §7.5 (FGC, simplificação documentada) e §7.6 (exposição sem garantia).
 * O que importa é o emissor, não onde o papel está custodiado.
 */
@Service
public class FgcService {

    static final Set<Produto> COBERTOS = EnumSet.of(Produto.CDB, Produto.RDB, Produto.LCI, Produto.LCA, Produto.LC, Produto.POUPANCA);
    static final Set<Produto> CREDITO_PRIVADO = EnumSet.of(Produto.DEBENTURE, Produto.CRI, Produto.CRA);

    private final Premissas premissas;

    public FgcService(Premissas premissas) {
        this.premissas = premissas;
    }

    private static final class Acumulador {
        BigDecimal elegivel = BigDecimal.ZERO;
        BigDecimal creditoPrivado = BigDecimal.ZERO;
        boolean empresa;
        boolean temConta;
        final java.util.TreeSet<Produto> produtos = new java.util.TreeSet<>();
        final java.util.TreeSet<String> entidades = new java.util.TreeSet<>();
        final Map<String, BigDecimal> porRotulo = new HashMap<>();   // "emi:<id>" ou "inst:<id>" → valor
    }

    public AnaliseFgc calcular(DadosVisiveis d) {
        Map<String, Acumulador> porCong = new LinkedHashMap<>();

        for (PosicaoInvestimento p : d.investimentos()) {
            Emissor e = d.emissor(p.emissorId());
            if (e == null) continue;
            boolean coberto = COBERTOS.contains(p.produto());
            boolean privado = CREDITO_PRIVADO.contains(p.produto());
            if (!coberto && !privado) continue;
            Acumulador a = porCong.computeIfAbsent(e.conglomeradoId(), k -> new Acumulador());
            if (coberto) a.elegivel = a.elegivel.add(p.valorAtual());
            if (privado) {
                a.creditoPrivado = a.creditoPrivado.add(p.valorAtual());
                a.empresa |= e.tipo() == TipoEmissor.EMPRESA;
            }
            a.porRotulo.merge("emi:" + e.id(), p.valorAtual(), BigDecimal::add);
            a.produtos.add(p.produto());
            a.entidades.add(e.nome());
        }
        for (Conta c : d.contas()) {
            if (c.tipo() != TipoConta.CORRENTE) continue;
            Instituicao i = d.instituicao(c.instituicaoId());
            if (i == null) continue;
            Acumulador a = porCong.computeIfAbsent(i.conglomeradoId(), k -> new Acumulador());
            a.elegivel = a.elegivel.add(c.saldo());
            a.porRotulo.merge("inst:" + i.id(), c.saldo(), BigDecimal::add);
            a.temConta = true;
            a.entidades.add(i.nome());
        }

        BigDecimal patrimonio = d.investimentos().stream().map(PosicaoInvestimento::valorAtual).reduce(BigDecimal.ZERO, BigDecimal::add)
                .add(d.contas().stream().map(Conta::saldo).reduce(BigDecimal.ZERO, BigDecimal::add));
        BigDecimal limite = premissas.fgc().limitePorConglomerado();

        List<AnaliseFgc.Conglomerado> resultado = new ArrayList<>();
        BigDecimal totalElegivel = BigDecimal.ZERO;
        for (Map.Entry<String, Acumulador> e : porCong.entrySet()) {
            Acumulador a = e.getValue();
            totalElegivel = totalElegivel.add(a.elegivel);
            BigDecimal excesso = a.elegivel.subtract(limite).max(BigDecimal.ZERO);
            BigDecimal exposicao = excesso.add(a.creditoPrivado);
            String rotulo = a.porRotulo.entrySet().stream().max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElse("");
            String emissorId = rotulo.startsWith("emi:") ? rotulo.substring(4) : null;
            String nome = emissorId != null ? d.emissor(emissorId).nome() : d.instituicao(rotulo.substring(5)).nome();
            String instituicaoId = d.todasInstituicoes().values().stream()
                    .filter(i -> i.conglomeradoId().equals(e.getKey()))
                    .sorted(Comparator.comparing((Instituicao i) -> !i.nome().startsWith("Banco")))
                    .map(Instituicao::id).findFirst().orElse(null);
            String congNome = d.todasInstituicoes().values().stream().filter(i -> i.conglomeradoId().equals(e.getKey()))
                    .map(Instituicao::conglomeradoNome).findFirst().orElse(nome);
            String referencia = a.entidades.size() > 1
                    ? "do conglomerado " + congNome + " (" + String.join(" e ", a.entidades) + ")"
                    : (a.empresa ? "da " : "do ") + nome;
            List<String> produtos = new ArrayList<>();
            if (a.temConta) produtos.add("conta corrente");
            a.produtos.forEach(p -> produtos.add(p == Produto.POUPANCA ? "poupança" : p.name()));
            resultado.add(new AnaliseFgc.Conglomerado(e.getKey(), nome, referencia, List.copyOf(produtos), emissorId, instituicaoId,
                    Dinheiro.de(a.elegivel), Dinheiro.de(excesso), Dinheiro.de(a.creditoPrivado), Dinheiro.de(exposicao),
                    patrimonio.signum() == 0 ? 0 : exposicao.divide(patrimonio, 4, RoundingMode.HALF_EVEN).doubleValue(),
                    a.empresa));
        }
        return new AnaliseFgc(resultado, Dinheiro.de(totalElegivel),
                totalElegivel.compareTo(premissas.fgc().tetoGlobal()) > 0, Dinheiro.de(patrimonio));
    }
}
