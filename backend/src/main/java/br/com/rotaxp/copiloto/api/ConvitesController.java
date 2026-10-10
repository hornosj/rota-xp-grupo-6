package br.com.rotaxp.copiloto.api;

import br.com.rotaxp.copiloto.dominio.Convite;
import br.com.rotaxp.copiloto.openfinance.ConviteService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Convites de consentimento Open Finance (PLAN §5 e §7.10). */
@RestController
@RequestMapping("/api")
public class ConvitesController {

    private final ConviteService convites;

    public ConvitesController(ConviteService convites) {
        this.convites = convites;
    }

    /** Cria o convite (ou devolve o PENDENTE que já existe). 409 se a instituição já está conectada. */
    @PostMapping("/clientes/{id}/convites/{instituicaoId}")
    public Convite convidar(@PathVariable String id, @PathVariable String instituicaoId) {
        return convites.convidar(id, instituicaoId);
    }

    @GetMapping("/clientes/{id}/convites")
    public List<Convite> doCliente(@PathVariable String id) {
        return convites.listar(id);
    }

    @GetMapping("/convites/{token}")
    public Convite convite(@PathVariable String token) {
        return convites.buscar(token);
    }

    /** O cliente confirmou no "ambiente do banco de origem" (simulado). 409 se já confirmado; 410 se expirado. */
    @PostMapping("/convites/{token}/confirmar")
    public Convite confirmar(@PathVariable String token) {
        return convites.confirmar(token);
    }
}
