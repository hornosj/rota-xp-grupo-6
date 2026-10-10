package br.com.rotaxp.copiloto.api;

import br.com.rotaxp.copiloto.agentes.Copiloto;
import br.com.rotaxp.copiloto.dominio.Radar.ImpactoNoticia;
import br.com.rotaxp.copiloto.dominio.Radar.MotivoNoticia;
import br.com.rotaxp.copiloto.dominio.Radar.NoticiaClassificada;
import br.com.rotaxp.copiloto.dominio.Radar.ResultadoProcessamento;
import br.com.rotaxp.copiloto.inteligencia.radar.RadarService;
import br.com.rotaxp.copiloto.inteligencia.radar.RadarWorker;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Radar de notícias (BE2-10). */
@RestController
@RequestMapping("/api")
public class RadarController {

    private final RadarService radar;
    private final RadarWorker worker;
    private final Copiloto copiloto;

    public RadarController(RadarService radar, RadarWorker worker, Copiloto copiloto) {
        this.radar = radar;
        this.worker = worker;
        this.copiloto = copiloto;
    }

    @GetMapping("/radar/noticias")
    public List<NoticiaClassificada> noticias() {
        return radar.noticias();
    }

    /** Processamento pontual (fora do cron): coleta, classifica só as novas e devolve o resumo. */
    @PostMapping("/radar/processar")
    public ResultadoProcessamento processar() {
        return worker.executar();
    }

    @GetMapping("/clientes/{id}/radar")
    public List<ImpactoNoticia> doCliente(@PathVariable String id) {
        return radar.impactosDoCliente(id);
    }

    @GetMapping("/assessor/radar")
    public List<ImpactoNoticia> daCarteira(@RequestParam(defaultValue = "20") int limite) {
        return radar.impactosDaCarteira(limite);
    }

    /** Por que a notícia é motivo de contato — texto para o assessor (stub/cache/live). */
    @PostMapping("/clientes/{id}/radar/{noticiaId}/motivo")
    public MotivoNoticia motivo(@PathVariable String id, @PathVariable String noticiaId) {
        return copiloto.redigirMotivoNoticia(id, noticiaId);
    }
}
