package br.com.rotaxp.copiloto.agentes;

import br.com.rotaxp.copiloto.demo.DataReferencia;
import java.time.LocalDate;

/**
 * Trava de crédito: no máximo N chamadas ao LLM por dia (dia real em São Paulo, não a data da demo).
 * Passou do limite, lança LimiteExcedido sem chamar o LLM — o Copiloto cai no stub e o radar nas regras.
 * Toda tentativa conta, inclusive as que falham.
 */
public class LimiteChamadasLlm implements ExecutorAgentes {

    public static class LimiteExcedido extends RuntimeException {
        public LimiteExcedido(String mensagem) { super(mensagem); }
    }

    public record Uso(int chamadasHoje, int limiteDiario) {}

    private final ExecutorAgentes real;
    private final int limiteDiario;
    private final DataReferencia relogio;
    private LocalDate dia;
    private int chamadas;

    public LimiteChamadasLlm(ExecutorAgentes real, int limiteDiario, DataReferencia relogio) {
        this.real = real;
        this.limiteDiario = Math.max(0, limiteDiario);
        this.relogio = relogio;
    }

    @Override
    public <T> T executar(Object entrada, Class<T> resultado) {
        reservar();
        return real.executar(entrada, resultado);
    }

    private synchronized void reservar() {
        zerarSeMudouODia();
        if (chamadas >= limiteDiario) {
            throw new LimiteExcedido("Limite diário de " + limiteDiario + " chamadas ao LLM atingido; usando o stub");
        }
        chamadas++;
    }

    public synchronized Uso uso() {
        zerarSeMudouODia();
        return new Uso(chamadas, limiteDiario);
    }

    private void zerarSeMudouODia() {
        LocalDate hoje = LocalDate.ofInstant(relogio.instante(), DataReferencia.ZONA);
        if (!hoje.equals(dia)) {
            dia = hoje;
            chamadas = 0;
        }
    }
}
