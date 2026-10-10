package br.com.rotaxp.copiloto.api;

import br.com.rotaxp.copiloto.analise.DesagioPosicaoService;
import br.com.rotaxp.copiloto.dominio.SimulacaoDesagio.DesagioDetalhado;
import br.com.rotaxp.copiloto.dominio.SimulacaoDesagio.DesagioPedido;
import br.com.rotaxp.copiloto.dominio.SimulacaoDesagio.PosicoesDesagio;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class DesagioController {

    private final DesagioPosicaoService service;

    public DesagioController(DesagioPosicaoService service) {
        this.service = service;
    }

    @GetMapping("/clientes/{id}/desagio/posicoes")
    public PosicoesDesagio posicoes(@PathVariable String id) {
        return service.posicoes(id);
    }

    @PostMapping("/simulacoes/desagio/detalhado")
    public DesagioDetalhado simular(@RequestBody DesagioPedido pedido) {
        return service.simular(pedido);
    }
}