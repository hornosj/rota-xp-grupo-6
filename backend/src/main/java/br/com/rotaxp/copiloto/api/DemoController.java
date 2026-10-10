package br.com.rotaxp.copiloto.api;

import br.com.rotaxp.copiloto.analise.DesagioService;
import br.com.rotaxp.copiloto.demo.DemoService;
import br.com.rotaxp.copiloto.dominio.Requisicoes.DemoEstado;
import br.com.rotaxp.copiloto.dominio.Requisicoes.DesagioBody;
import br.com.rotaxp.copiloto.dominio.Requisicoes.DesagioResultado;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class DemoController {

    private final DemoService demo;
    private final DesagioService desagio;

    public DemoController(DemoService demo, DesagioService desagio) {
        this.demo = demo;
        this.desagio = desagio;
    }

    @PostMapping("/demo/reset")
    public ResponseEntity<Void> reset() {
        demo.resetar();
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/demo/estado")
    public DemoEstado estado() {
        return demo.estado();
    }

    @PostMapping("/simulacoes/desagio")
    public DesagioResultado desagio(@RequestBody DesagioBody body) {
        return desagio.simular(body);
    }
}
