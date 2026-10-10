package br.com.rotaxp.copiloto.api;

import br.com.rotaxp.copiloto.agentes.Copiloto;
import br.com.rotaxp.copiloto.consolidacao.Visao360Assembler;
import br.com.rotaxp.copiloto.dominio.Briefing;
import br.com.rotaxp.copiloto.dominio.ClienteResumo;
import br.com.rotaxp.copiloto.dominio.ConsentimentoView;
import br.com.rotaxp.copiloto.dominio.Enums.Canal;
import br.com.rotaxp.copiloto.dominio.MensagemGerada;
import br.com.rotaxp.copiloto.dominio.Principalidade;
import br.com.rotaxp.copiloto.dominio.Requisicoes.NotaBody;
import br.com.rotaxp.copiloto.dominio.Requisicoes.PedidoMensagemBody;
import br.com.rotaxp.copiloto.dominio.ResultadoNota;
import br.com.rotaxp.copiloto.dominio.Visao360;
import br.com.rotaxp.copiloto.inteligencia.FilaService;
import br.com.rotaxp.copiloto.inteligencia.NotaService;
import br.com.rotaxp.copiloto.openfinance.ConsentimentoService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/clientes")
public class ClientesController {

    private final Visao360Assembler assembler;
    private final ConsentimentoService consentimentos;
    private final FilaService fila;
    private final Copiloto copiloto;
    private final NotaService notas;

    public ClientesController(Visao360Assembler assembler, ConsentimentoService consentimentos, FilaService fila,
                              Copiloto copiloto, NotaService notas) {
        this.assembler = assembler;
        this.consentimentos = consentimentos;
        this.fila = fila;
        this.copiloto = copiloto;
        this.notas = notas;
    }

    @GetMapping
    public List<ClienteResumo> listar() {
        return fila.resumos();
    }

    @GetMapping("/{id}/360")
    public Visao360 visao360(@PathVariable String id) {
        return assembler.visao360(id);
    }

    @GetMapping("/{id}/principalidade")
    public Principalidade principalidade(@PathVariable String id) {
        return assembler.analisar(id).principalidade();
    }

    @GetMapping("/{id}/consentimentos")
    public List<ConsentimentoView> consentimentos(@PathVariable String id) {
        return consentimentos.listar(id);
    }

    /** Devolve a 360 já recalculada. 409 se o consentimento já estiver ativo. */
    @PostMapping("/{id}/consentimentos/{instituicaoId}/conceder")
    public Visao360 conceder(@PathVariable String id, @PathVariable String instituicaoId) {
        consentimentos.conceder(id, instituicaoId);
        return assembler.visao360(id);
    }

    @PostMapping("/{id}/consentimentos/{instituicaoId}/revogar")
    public Visao360 revogar(@PathVariable String id, @PathVariable String instituicaoId) {
        consentimentos.revogar(id, instituicaoId);
        return assembler.visao360(id);
    }

    @PostMapping("/{id}/acoes/{acaoId}/mensagem")
    public MensagemGerada mensagem(@PathVariable String id, @PathVariable String acaoId,
                                   @RequestBody(required = false) PedidoMensagemBody body) {
        Canal canal = body == null || body.canal() == null ? Canal.WHATSAPP : body.canal();
        return copiloto.redigirMensagem(id, acaoId, canal);
    }

    @GetMapping("/{id}/briefing")
    public Briefing briefing(@PathVariable String id) {
        return copiloto.gerarBriefing(id);
    }

    @PostMapping("/{id}/notas")
    public ResultadoNota nota(@PathVariable String id, @RequestBody NotaBody body) {
        return notas.processar(id, body.transcricao());
    }
}
