package br.com.rotaxp.copiloto.agentes;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.rotaxp.copiloto.demo.DataReferencia;
import br.com.rotaxp.copiloto.support.CenarioBuilder;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

/** Trava de crédito: no máximo N chamadas ao LLM por dia (dia real, não a data da demo). */
class LimiteChamadasLlmTest {

    static class Relogio extends Clock {
        Instant agora = Instant.parse("2026-10-11T15:00:00Z");   // 12h em São Paulo
        @Override public ZoneId getZone() { return DataReferencia.ZONA; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return agora; }
    }

    static class Contador implements ExecutorAgentes {
        int chamadas;
        @Override public <T> T executar(Object entrada, Class<T> resultado) {
            chamadas++;
            return resultado.cast("ok");
        }
    }

    private final Relogio relogio = new Relogio();
    private final Contador real = new Contador();
    private final LimiteChamadasLlm limite = new LimiteChamadasLlm(real, 3, new DataReferencia(CenarioBuilder.REF, relogio));

    @Test
    void deixaPassarAteOLimiteEDepoisRecusaSemChamarOLlm() {
        for (int i = 0; i < 3; i++) assertThat(limite.executar("x", String.class)).isEqualTo("ok");

        assertThatThrownBy(() -> limite.executar("x", String.class)).isInstanceOf(LimiteChamadasLlm.LimiteExcedido.class)
                .hasMessageContaining("3");
        assertThat(real.chamadas).isEqualTo(3);
        assertThat(limite.uso()).isEqualTo(new LimiteChamadasLlm.Uso(3, 3));
    }

    @Test
    void contadorZeraNoDiaSeguinte() {
        for (int i = 0; i < 3; i++) limite.executar("x", String.class);

        relogio.agora = relogio.agora.plus(Duration.ofHours(13));   // 01h do dia seguinte em São Paulo

        assertThat(limite.executar("x", String.class)).isEqualTo("ok");
        assertThat(limite.uso().chamadasHoje()).isEqualTo(1);
    }

    @Test
    void falhaDoLlmTambemConta() {
        ExecutorAgentes quebrado = new ExecutorAgentes() {
            @Override public <T> T executar(Object entrada, Class<T> resultado) { throw new IllegalStateException("401"); }
        };
        LimiteChamadasLlm l = new LimiteChamadasLlm(quebrado, 2, new DataReferencia(CenarioBuilder.REF, relogio));

        assertThatThrownBy(() -> l.executar("x", String.class)).isInstanceOf(IllegalStateException.class);
        assertThat(l.uso().chamadasHoje()).isEqualTo(1);
    }

    @Test
    void limiteZeroDesligaOLlm() {
        LimiteChamadasLlm desligado = new LimiteChamadasLlm(real, 0, new DataReferencia(CenarioBuilder.REF, relogio));

        assertThatThrownBy(() -> desligado.executar("x", String.class)).isInstanceOf(LimiteChamadasLlm.LimiteExcedido.class);
        assertThat(real.chamadas).isZero();
    }
}
