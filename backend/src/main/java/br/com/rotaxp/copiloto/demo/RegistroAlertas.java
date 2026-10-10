package br.com.rotaxp.copiloto.demo;

import br.com.rotaxp.copiloto.config.DemoProps;
import br.com.rotaxp.copiloto.dominio.Alerta;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * Guarda o primeiro instante em que cada alerta (cliente|tipo|instituicao|emissor) foi detectado.
 * Alertas registrados na linha de base (startup/reset) nunca são "novos".
 */
@Component
public class RegistroAlertas {

    private record Registro(Instant instante, OffsetDateTime detectadoEm, boolean linhaDeBase) {}

    private final Map<String, Registro> registros = new ConcurrentHashMap<>();
    private final DataReferencia dataReferencia;
    private final Duration janelaNovo;
    private volatile boolean emLinhaDeBase = false;

    public RegistroAlertas(DataReferencia dataReferencia, DemoProps props) {
        this.dataReferencia = dataReferencia;
        this.janelaNovo = Duration.ofMinutes(props.janelaAlertaNovoMinutos());
    }

    public void limpar() { registros.clear(); }

    public void iniciarLinhaDeBase() { emLinhaDeBase = true; }

    public void encerrarLinhaDeBase() { emLinhaDeBase = false; }

    public List<Alerta> marcar(List<Alerta> alertas) {
        Instant agora = dataReferencia.instante();
        return alertas.stream().map(a -> {
            Registro r = registros.computeIfAbsent(a.chave(), k -> emLinhaDeBase
                    ? new Registro(agora, OffsetDateTime.of(dataReferencia.hoje(), LocalTime.of(8, 0),
                            DataReferencia.ZONA.getRules().getOffset(agora)), true)
                    : new Registro(agora, dataReferencia.agora(), false));
            boolean novo = !r.linhaDeBase() && Duration.between(r.instante(), agora).compareTo(janelaNovo) < 0;
            return a.comRegistro(r.detectadoEm(), novo);
        }).toList();
    }
}
