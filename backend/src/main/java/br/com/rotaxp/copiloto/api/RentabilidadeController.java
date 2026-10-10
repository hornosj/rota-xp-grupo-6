package br.com.rotaxp.copiloto.api;

import br.com.rotaxp.copiloto.analise.RentabilidadeService;
import br.com.rotaxp.copiloto.dominio.SimulacaoRentabilidade.RentabilidadePedido;
import br.com.rotaxp.copiloto.dominio.SimulacaoRentabilidade.RentabilidadeResultado;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/simulacoes")
public class RentabilidadeController {

    private final RentabilidadeService service;

    public RentabilidadeController(RentabilidadeService service) {
        this.service = service;
    }

    @PostMapping("/rentabilidade")
    public RentabilidadeResultado simular(@RequestBody RentabilidadePedido pedido) {
        return service.simular(pedido);
    }
}
