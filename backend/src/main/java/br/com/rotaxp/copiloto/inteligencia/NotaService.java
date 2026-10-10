package br.com.rotaxp.copiloto.inteligencia;

import br.com.rotaxp.copiloto.agentes.Copiloto;
import br.com.rotaxp.copiloto.consolidacao.Visao360Assembler;
import br.com.rotaxp.copiloto.dominio.ResultadoNota;
import br.com.rotaxp.copiloto.openfinance.ConsentimentoAlterado;
import br.com.rotaxp.copiloto.openfinance.Repositorio;
import org.springframework.stereotype.Service;

/** Nota pós-reunião (P2): o Copiloto extrai os fatos; aqui os eventos de vida são persistidos. */
@Service
public class NotaService {

    private final Copiloto copiloto;
    private final Repositorio repo;
    private final Visao360Assembler assembler;

    public NotaService(Copiloto copiloto, Repositorio repo, Visao360Assembler assembler) {
        this.copiloto = copiloto;
        this.repo = repo;
        this.assembler = assembler;
    }

    public ResultadoNota processar(String clienteId, String transcricao) {
        repo.cliente(clienteId);
        ResultadoNota r = copiloto.processarNota(clienteId, transcricao == null ? "" : transcricao);
        if (!r.eventosCriados().isEmpty()) {
            repo.adicionarEventos(clienteId, r.eventosCriados());
            assembler.aoAlterarConsentimento(new ConsentimentoAlterado(clienteId, null));
        }
        return r;
    }
}
