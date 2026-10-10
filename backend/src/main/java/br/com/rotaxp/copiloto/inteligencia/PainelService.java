package br.com.rotaxp.copiloto.inteligencia;

import br.com.rotaxp.copiloto.config.AlertasProps;
import br.com.rotaxp.copiloto.config.DemoProps;
import br.com.rotaxp.copiloto.consolidacao.AnaliseCliente;
import br.com.rotaxp.copiloto.consolidacao.Visao360Assembler;
import br.com.rotaxp.copiloto.demo.DataReferencia;
import br.com.rotaxp.copiloto.dominio.Alerta;
import br.com.rotaxp.copiloto.dominio.Consentimento;
import br.com.rotaxp.copiloto.dominio.Enums.PosicaoXp;
import br.com.rotaxp.copiloto.dominio.Enums.Severidade;
import br.com.rotaxp.copiloto.dominio.PainelCarteira;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.temporal.ChronoUnit;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** KPIs da carteira do assessor. */
@Service
public class PainelService {

    private final Visao360Assembler assembler;
    private final DemoProps demo;
    private final AlertasProps alertasProps;
    private final DataReferencia dataReferencia;

    public PainelService(Visao360Assembler assembler, DemoProps demo, AlertasProps alertasProps, DataReferencia dataReferencia) {
        this.assembler = assembler;
        this.demo = demo;
        this.alertasProps = alertasProps;
        this.dataReferencia = dataReferencia;
    }

    public PainelCarteira painel() {
        List<AnaliseCliente> analises = assembler.clientes().stream()
                .filter(c -> demo.assessorId().equals(c.assessorId()))
                .map(c -> assembler.analisar(c.id())).toList();

        BigDecimal naXp = BigDecimal.ZERO;
        BigDecimal foraXp = BigDecimal.ZERO;
        double somaCobertura = 0;
        int expirando = 0;
        int alertaAlto = 0;
        Map<PosicaoXp, Integer> distribuicao = new EnumMap<>(PosicaoXp.class);
        for (PosicaoXp p : PosicaoXp.values()) distribuicao.put(p, 0);

        for (AnaliseCliente a : analises) {
            naXp = naXp.add(a.base().patrimonio().naXp());
            foraXp = foraXp.add(a.base().patrimonio().foraXp());
            somaCobertura += a.base().cobertura().percentual();
            distribuicao.merge(a.principalidade().posicaoXp(), 1, Integer::sum);
            if (a.alertas().stream().map(Alerta::severidade).anyMatch(s -> s == Severidade.ALTA)) alertaAlto++;
            for (Consentimento c : a.dados().consentimentos()) {
                if (!c.ativo() || c.expiraEm() == null) continue;
                long dias = ChronoUnit.DAYS.between(dataReferencia.hoje(), c.expiraEm());
                if (dias >= 0 && dias <= alertasProps.consentimentoExpirandoDias()) expirando++;
            }
        }
        int total = analises.size();
        return new PainelCarteira(demo.assessorId(), total, naXp.setScale(2), foraXp.setScale(2),
                fracao(distribuicao.get(PosicaoXp.PRINCIPAL), total), distribuicao,
                total == 0 ? 0 : arred(somaCobertura / total), expirando, alertaAlto);
    }

    private static double fracao(int parte, int total) {
        return total == 0 ? 0 : arred((double) parte / total);
    }

    private static double arred(double v) {
        return BigDecimal.valueOf(v).setScale(3, RoundingMode.HALF_EVEN).doubleValue();
    }
}
