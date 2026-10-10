package br.com.rotaxp.copiloto.demo;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotaxp.copiloto.dominio.Alerta;
import br.com.rotaxp.copiloto.dominio.Enums.Severidade;
import br.com.rotaxp.copiloto.dominio.Enums.TipoAlerta;
import br.com.rotaxp.copiloto.support.CenarioBuilder;
import br.com.rotaxp.copiloto.support.Infra;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

class RegistroAlertasTest {

    /** Relógio que dá para avançar. */
    static class RelogioMovel extends Clock {
        Instant agora = Instant.parse("2026-10-10T12:00:00Z");
        @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return agora; }
    }

    private final RelogioMovel relogio = new RelogioMovel();
    private final RegistroAlertas registro =
            new RegistroAlertas(new DataReferencia(CenarioBuilder.REF, relogio), Infra.demoProps());

    private static Alerta alerta(TipoAlerta tipo) {
        return new Alerta("a", "cli-001", tipo, Severidade.ALTA, "t", "e", null, "inst-horizonte", null, null, false);
    }

    @Test
    void alertasDaLinhaDeBaseNuncaSaoNovos() {
        registro.iniciarLinhaDeBase();
        registro.marcar(List.of(alerta(TipoAlerta.SALDO_PARADO)));
        registro.encerrarLinhaDeBase();

        Alerta a = registro.marcar(List.of(alerta(TipoAlerta.SALDO_PARADO))).get(0);

        assertThat(a.novo()).isFalse();
        assertThat(a.detectadoEm().toLocalDate()).isEqualTo(CenarioBuilder.REF);
    }

    @Test
    void alertaDetectadoDepoisFicaNovoDuranteAJanela() {
        Alerta a = registro.marcar(List.of(alerta(TipoAlerta.FGC_EXCEDIDO))).get(0);
        assertThat(a.novo()).isTrue();

        relogio.agora = relogio.agora.plus(Duration.ofMinutes(9));
        assertThat(registro.marcar(List.of(alerta(TipoAlerta.FGC_EXCEDIDO))).get(0).novo()).isTrue();

        relogio.agora = relogio.agora.plus(Duration.ofMinutes(2));
        assertThat(registro.marcar(List.of(alerta(TipoAlerta.FGC_EXCEDIDO))).get(0).novo()).isFalse();
    }

    @Test
    void limparEsqueceORegistro() {
        registro.iniciarLinhaDeBase();
        registro.marcar(List.of(alerta(TipoAlerta.FGC_EXCEDIDO)));
        registro.encerrarLinhaDeBase();
        registro.limpar();

        assertThat(registro.marcar(List.of(alerta(TipoAlerta.FGC_EXCEDIDO))).get(0).novo()).isTrue();
    }
}
