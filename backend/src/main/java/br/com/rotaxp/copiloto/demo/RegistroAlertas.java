package br.com.rotaxp.copiloto.demo;

import br.com.rotaxp.copiloto.config.DemoProps;
import br.com.rotaxp.copiloto.demo.ArmazemAlertas.Registro;
import br.com.rotaxp.copiloto.dominio.Alerta;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Guarda o primeiro instante em que cada alerta (cliente|tipo|instituicao|emissor) foi detectado.
 * Alertas registrados na linha de base (startup/reset) nunca são "novos".
 * O mapa em memória é o cache; o ArmazemAlertas (SQLite por padrão) mantém o registro entre reinícios.
 */
@Component
public class RegistroAlertas {

    private final Map<String, Registro> registros = new ConcurrentHashMap<>();
    private final DataReferencia dataReferencia;
    private final Duration janelaNovo;
    private final ArmazemAlertas armazem;
    private volatile boolean emLinhaDeBase = false;

    @Autowired
    public RegistroAlertas(DataReferencia dataReferencia, DemoProps props, ObjectProvider<ArmazemAlertas> armazem) {
        this(dataReferencia, props, armazem.getIfAvailable(() -> ArmazemAlertas.EM_MEMORIA));
    }

    public RegistroAlertas(DataReferencia dataReferencia, DemoProps props) {
        this(dataReferencia, props, ArmazemAlertas.EM_MEMORIA);
    }

    public RegistroAlertas(DataReferencia dataReferencia, DemoProps props, ArmazemAlertas armazem) {
        this.dataReferencia = dataReferencia;
        this.janelaNovo = Duration.ofMinutes(props.janelaAlertaNovoMinutos());
        this.armazem = armazem;
        registros.putAll(armazem.carregar());
    }

    public synchronized void limpar() {
        registros.clear();
        armazem.limpar();
    }

    public void iniciarLinhaDeBase() { emLinhaDeBase = true; }

    public void encerrarLinhaDeBase() { emLinhaDeBase = false; }

    public List<Alerta> marcar(List<Alerta> alertas) {
        Instant agora = dataReferencia.instante();
        Map<String, Registro> novos = new LinkedHashMap<>();
        List<Alerta> marcados = alertas.stream().map(a -> {
            Registro r = registros.computeIfAbsent(a.chave(), k -> {
                Registro criado = emLinhaDeBase
                        ? new Registro(agora, OffsetDateTime.of(dataReferencia.hoje(), LocalTime.of(8, 0),
                                DataReferencia.ZONA.getRules().getOffset(agora)), true)
                        : new Registro(agora, dataReferencia.agora(), false);
                novos.put(k, criado);
                return criado;
            });
            boolean novo = !r.linhaDeBase() && Duration.between(r.instante(), agora).compareTo(janelaNovo) < 0;
            return a.comRegistro(r.detectadoEm(), novo);
        }).toList();
        armazem.salvar(novos);
        return marcados;
    }
}
