package br.com.rotaxp.copiloto.analise;

import br.com.rotaxp.copiloto.config.PrioridadeProps;
import br.com.rotaxp.copiloto.dominio.Alerta;
import br.com.rotaxp.copiloto.dominio.Enums.PosicaoXp;
import br.com.rotaxp.copiloto.dominio.Enums.Severidade;
import br.com.rotaxp.copiloto.dominio.ItemFila.Motivo;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** PLAN §7.9 — prioridade da fila como scorecard de pontos por origem. */
@Service
public class PrioridadeService {

    private final PrioridadeProps p;

    public PrioridadeService(PrioridadeProps props) {
        this.p = props;
    }

    public ResultadoPrioridade calcular(List<Alerta> alertas, PosicaoXp posicaoXp) {
        List<Motivo> motivos = new ArrayList<>();
        Map<String, Double> porAlerta = new LinkedHashMap<>();
        for (Alerta a : alertas) {
            double pts = pontos(a);
            porAlerta.put(a.id(), pts);
            motivos.add(new Motivo(a.titulo(), pts));
        }
        motivos.sort(Comparator.comparingDouble(Motivo::pontos).reversed());
        if (posicaoXp == PosicaoXp.SO_INVESTIMENTOS && p.bonusSoInvestimentos() > 0) {
            motivos.add(new Motivo("XP só nos investimentos", p.bonusSoInvestimentos()));
        }
        double soma = motivos.stream().mapToDouble(Motivo::pontos).sum();
        return new ResultadoPrioridade(arred(Math.min(100, soma)), List.copyOf(motivos), porAlerta);
    }

    public double pontos(Alerta a) {
        double v = a.valor() == null ? 0 : a.valor().doubleValue();
        double pts = switch (a.tipo()) {
            case FGC_EXCEDIDO -> p.fgcBase() + Math.min(p.fgcMaxExtra(), p.fgcPor20k() * v / 20_000);
            case FGC_TETO_GLOBAL -> p.fgcTetoGlobal();
            case CONCENTRACAO_EMISSOR -> p.concentracaoBase() + (a.severidade() == Severidade.ALTA ? p.concentracaoAltaExtra() : 0);
            case VENCIMENTO_PROXIMO -> p.vencimentoBase() + Math.min(p.vencimentoMaxExtra(), p.vencimentoPor50k() * v / 50_000);
            case SALDO_PARADO -> p.saldoParadoBase() + Math.min(p.saldoParadoMaxExtra(), p.saldoParadoPor10k() * v / 10_000);
            case RENDA_FORA_XP -> p.rendaFora();
            case CONSENTIMENTO_EXPIRANDO -> p.consentimentoExpirando();
            case RESERVA_INSUFICIENTE -> p.reservaInsuficiente();
            case EVENTO_VIDA_PROXIMO -> p.eventoVida();
        };
        return arred(pts);
    }

    private static double arred(double v) {
        return BigDecimal.valueOf(v).setScale(1, java.math.RoundingMode.HALF_EVEN).doubleValue();
    }
}
