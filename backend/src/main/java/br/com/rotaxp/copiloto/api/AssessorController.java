package br.com.rotaxp.copiloto.api;

import br.com.rotaxp.copiloto.dominio.ItemFila;
import br.com.rotaxp.copiloto.dominio.PainelCarteira;
import br.com.rotaxp.copiloto.inteligencia.FilaService;
import br.com.rotaxp.copiloto.inteligencia.PainelService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/assessor")
public class AssessorController {

    private final FilaService fila;
    private final PainelService painel;

    public AssessorController(FilaService fila, PainelService painel) {
        this.fila = fila;
        this.painel = painel;
    }

    /** Fila "Hoje", já ordenada. */
    @GetMapping("/fila")
    public List<ItemFila> fila() {
        return fila.fila();
    }

    @GetMapping("/painel")
    public PainelCarteira painel() {
        return painel.painel();
    }
}
