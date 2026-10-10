package br.com.rotaxp.copiloto.analise;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotaxp.copiloto.config.PrioridadeProps;
import br.com.rotaxp.copiloto.dominio.Alerta;
import br.com.rotaxp.copiloto.dominio.Enums.PosicaoXp;
import br.com.rotaxp.copiloto.dominio.Enums.Severidade;
import br.com.rotaxp.copiloto.dominio.Enums.TipoAlerta;
import br.com.rotaxp.copiloto.dominio.ItemFila.Motivo;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.api.Test;

class PrioridadeServiceTest {

    private final PrioridadeService service = new PrioridadeService(new PrioridadeProps(
            35, 1, 25, 10, 15, 10, 15, 1, 10, 10, 1, 10, 10, 10, 8, 8, 5));

    private static Alerta alerta(TipoAlerta tipo, Severidade sev, String valor) {
        return new Alerta("alr-" + tipo, "cli", tipo, sev, "título " + tipo, "e",
                valor == null ? null : new BigDecimal(valor), null, null, null, false);
    }

    @ParameterizedTest
    @CsvSource(nullValues = "-", value = {
            "FGC_EXCEDIDO, ALTA, 400000, 55",
            "FGC_EXCEDIDO, ALTA, 80000, 39",
            "FGC_EXCEDIDO, ALTA, 900000, 60",
            "FGC_TETO_GLOBAL, MEDIA, 1200000, 10",
            "CONCENTRACAO_EMISSOR, MEDIA, 400000, 15",
            "CONCENTRACAO_EMISSOR, ALTA, 900000, 25",
            "VENCIMENTO_PROXIMO, MEDIA, 240000, 19.8",
            "VENCIMENTO_PROXIMO, MEDIA, 900000, 25",
            "SALDO_PARADO, MEDIA, 61000, 16.1",
            "SALDO_PARADO, MEDIA, 13000, 11.3",
            "SALDO_PARADO, MEDIA, 500000, 20",
            "RENDA_FORA_XP, BAIXA, 14000, 10",
            "CONSENTIMENTO_EXPIRANDO, MEDIA, -, 10",
            "RESERVA_INSUFICIENTE, MEDIA, 27000, 8",
            "EVENTO_VIDA_PROXIMO, BAIXA, -, 8",
    })
    void pontosPorAlerta(TipoAlerta tipo, Severidade sev, String valor, double pontos) {
        assertThat(service.pontos(alerta(tipo, sev, valor))).isEqualTo(pontos);
    }

    @Test
    void marinaAntesSoma39vir1ComBonusSoInvestimentos() {
        ResultadoPrioridade r = service.calcular(List.of(
                alerta(TipoAlerta.SALDO_PARADO, Severidade.MEDIA, "61000"),
                alerta(TipoAlerta.RENDA_FORA_XP, Severidade.BAIXA, "14000"),
                alerta(TipoAlerta.EVENTO_VIDA_PROXIMO, Severidade.BAIXA, null)), PosicaoXp.SO_INVESTIMENTOS);

        assertThat(r.prioridade()).isEqualTo(39.1);
        assertThat(r.motivos()).extracting(Motivo::pontos).containsExactly(16.1, 10.0, 8.0, 5.0);
        assertThat(r.motivos().get(3).texto()).isEqualTo("XP só nos investimentos");
        assertThat(r.pontosPorAlerta()).containsEntry("alr-SALDO_PARADO", 16.1);
    }

    @Test
    void prioridadeTemTetoDe100() {
        ResultadoPrioridade r = service.calcular(List.of(
                alerta(TipoAlerta.FGC_EXCEDIDO, Severidade.ALTA, "400000"),
                alerta(TipoAlerta.CONCENTRACAO_EMISSOR, Severidade.MEDIA, "400000"),
                alerta(TipoAlerta.SALDO_PARADO, Severidade.MEDIA, "61000"),
                alerta(TipoAlerta.RENDA_FORA_XP, Severidade.BAIXA, "14000"),
                alerta(TipoAlerta.EVENTO_VIDA_PROXIMO, Severidade.BAIXA, null)), PosicaoXp.SO_INVESTIMENTOS);

        assertThat(r.prioridade()).isEqualTo(100.0);
        assertThat(r.motivos().get(0).pontos()).isEqualTo(55.0);   // motivos ordenados por pontos
    }

    @Test
    void semAlertasEXpPrincipalEhZero() {
        ResultadoPrioridade r = service.calcular(List.of(), PosicaoXp.PRINCIPAL);

        assertThat(r.prioridade()).isZero();
        assertThat(r.motivos()).isEmpty();
    }
}
