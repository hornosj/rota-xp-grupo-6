package br.com.rotaxp.copiloto.inteligencia.radar;

import br.com.rotaxp.copiloto.config.RadarProps;
import br.com.rotaxp.copiloto.dominio.Radar.ResultadoProcessamento;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Worker do radar: coleta a cada 30 min (sem LLM) e classifica o acumulado no cron configurado (padrão 6×/dia em
 * dias úteis); opcionalmente processa no startup.
 * Para rodar "pontualmente" há o POST /api/radar/processar.
 */
@Component
public class RadarWorker {

    private static final Logger log = LoggerFactory.getLogger(RadarWorker.class);

    private final RadarService radar;
    private final RadarProps props;

    public RadarWorker(RadarService radar, RadarProps props) {
        this.radar = radar;
        this.props = props;
    }

    @Scheduled(cron = "${radar.cron}", zone = "America/Sao_Paulo")
    public void agendado() {
        if (props.workerHabilitado()) executar();
    }

    /** Coleta frequente e barata (sem LLM): não deixa notícia sair de feed curto sem ser vista. */
    @Scheduled(cron = "${radar.cron-coleta}", zone = "America/Sao_Paulo")
    public void coletaAgendada() {
        if (!props.workerHabilitado()) return;
        int novas = radar.coletar();
        if (novas > 0) log.info("Radar: {} notícias novas pendentes ({} no total)", novas, radar.pendentes());
    }

    @EventListener(ApplicationReadyEvent.class)
    public void aoIniciar() {
        if (props.processarNoInicio()) executar();
    }

    public ResultadoProcessamento executar() {
        ResultadoProcessamento r = radar.processar();
        log.info("Radar: {} coletadas, {} novas ({} por LLM em {} lotes, {} por regra)",
                r.coletadas(), r.novas(), r.classificadasPorLlm(), r.lotes(), r.classificadasPorRegra());
        return r;
    }
}
