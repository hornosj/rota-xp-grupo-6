package br.com.rotaxp.copiloto.consolidacao;

import br.com.rotaxp.copiloto.analise.Dinheiro;
import br.com.rotaxp.copiloto.dominio.Conta;
import br.com.rotaxp.copiloto.dominio.Instituicao;
import br.com.rotaxp.copiloto.dominio.Patrimonio;
import br.com.rotaxp.copiloto.dominio.Patrimonio.PorInstituicao;
import br.com.rotaxp.copiloto.dominio.Patrimonio.PorProduto;
import br.com.rotaxp.copiloto.dominio.PosicaoInvestimento;
import br.com.rotaxp.copiloto.openfinance.DadosVisiveis;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** Patrimônio visível: investimentos (por custodiante) + saldos em conta. */
@Service
public class PatrimonioService {

    public Patrimonio calcular(DadosVisiveis d) {
        Map<String, BigDecimal> invPorInst = new LinkedHashMap<>();
        Map<String, BigDecimal> contaPorInst = new LinkedHashMap<>();
        Map<String, BigDecimal> porProduto = new LinkedHashMap<>();
        for (PosicaoInvestimento p : d.investimentos()) {
            invPorInst.merge(p.instituicaoId(), p.valorAtual(), BigDecimal::add);
            porProduto.merge(p.produto().name(), p.valorAtual(), BigDecimal::add);
        }
        for (Conta c : d.contas()) {
            contaPorInst.merge(c.instituicaoId(), c.saldo(), BigDecimal::add);
            porProduto.merge("SALDO_CONTA", c.saldo(), BigDecimal::add);
        }

        List<PorInstituicao> instituicoes = new ArrayList<>();
        BigDecimal naXp = BigDecimal.ZERO;
        BigDecimal total = BigDecimal.ZERO;
        for (Instituicao inst : d.instituicoesVisiveis().values()) {
            BigDecimal inv = invPorInst.getOrDefault(inst.id(), BigDecimal.ZERO);
            BigDecimal saldo = contaPorInst.getOrDefault(inst.id(), BigDecimal.ZERO);
            BigDecimal soma = inv.add(saldo);
            instituicoes.add(new PorInstituicao(inst.id(), inst.nome(), inst.ehXp(), Dinheiro.de(inv), Dinheiro.de(saldo), Dinheiro.de(soma)));
            total = total.add(soma);
            if (inst.ehXp()) naXp = naXp.add(soma);
        }
        instituicoes.sort(Comparator.comparing((PorInstituicao p) -> !p.ehXp())
                .thenComparing(PorInstituicao::total, Comparator.reverseOrder()));

        List<PorProduto> produtos = porProduto.entrySet().stream()
                .map(e -> new PorProduto(e.getKey(), Dinheiro.de(e.getValue())))
                .sorted(Comparator.comparing(PorProduto::total).reversed()).toList();

        double share = total.signum() == 0 ? 0 : naXp.divide(total, 4, RoundingMode.HALF_EVEN).doubleValue();
        return new Patrimonio(Dinheiro.de(total), Dinheiro.de(naXp), Dinheiro.de(total.subtract(naXp)), share,
                List.copyOf(instituicoes), produtos);
    }
}
