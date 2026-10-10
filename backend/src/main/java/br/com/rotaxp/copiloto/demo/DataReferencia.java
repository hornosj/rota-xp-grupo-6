package br.com.rotaxp.copiloto.demo;

import br.com.rotaxp.copiloto.config.DemoProps;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.YearMonth;
import org.springframework.stereotype.Component;

/**
 * Única fonte de "hoje" da aplicação. A data vem de demo.data-referencia (determinismo da demo);
 * só a hora do dia vem do relógio real, para a janela de alertas "novos".
 */
@Component
public class DataReferencia {

    public static final ZoneId ZONA = ZoneId.of("America/Sao_Paulo");

    private final LocalDate data;
    private final Clock relogio;

    @org.springframework.beans.factory.annotation.Autowired
    public DataReferencia(DemoProps props) {
        this(props.dataReferencia(), Clock.system(ZONA));
    }

    public DataReferencia(LocalDate data, Clock relogio) {
        this.data = data;
        this.relogio = relogio;
    }

    public LocalDate hoje() { return data; }

    /** Mês de referência (o mês corrente da data de referência, ainda incompleto). */
    public YearMonth mesReferencia() { return YearMonth.from(data); }

    /** Data de referência com a hora atual — usada em atualizadoEm/detectadoEm. */
    public OffsetDateTime agora() {
        return OffsetDateTime.of(data, LocalTime.now(relogio), ZONA.getRules().getOffset(relogio.instant()));
    }

    /** Instante real, só para medir janelas de tempo da demo. */
    public Instant instante() { return relogio.instant(); }
}
