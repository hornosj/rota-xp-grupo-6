package br.com.rotaxp.copiloto.analise;

import br.com.rotaxp.copiloto.dominio.Requisicoes.DesagioBody;
import br.com.rotaxp.copiloto.dominio.Requisicoes.DesagioResultado;
import java.math.BigDecimal;
import java.math.RoundingMode;
import org.springframework.stereotype.Service;

/** PLAN §7.11 — break-even pós-deságio: t = ln(1/(1−D)) / ln((1+rNova)/(1+rAntiga)). */
@Service
public class DesagioService {

    public DesagioResultado simular(DesagioBody b) {
        double d = b.desagio().doubleValue();
        double antiga = b.taxaAntiga().doubleValue();
        double nova = b.taxaNova().doubleValue();
        double prazo = b.prazoRestanteAnos().doubleValue();
        if (d <= 0 || d >= 1 || nova <= antiga) {
            return new DesagioResultado(0, false, "Só compensa vender com deságio se a nova taxa for maior que a antiga "
                    + "e o deságio estiver entre 0% e 100%.");
        }
        double t = Math.log(1 / (1 - d)) / Math.log((1 + nova) / (1 + antiga));
        double anos = BigDecimal.valueOf(t).setScale(1, RoundingMode.HALF_EVEN).doubleValue();
        boolean compensa = t < prazo;
        String explicacao = "Com deságio de " + Texto.pct(d) + ", trocar " + Texto.pct(antiga) + " a.a. por " + Texto.pct(nova)
                + " a.a. recupera a perda em " + Texto.decimal(anos) + " ano(s). Como faltam " + Texto.decimal(prazo)
                + " ano(s) para o vencimento, " + (compensa ? "a troca compensa" : "a troca não compensa")
                + ". Simulação simplificada: ignora IR e supõe risco equivalente entre os títulos.";
        return new DesagioResultado(anos, compensa, explicacao);
    }
}
