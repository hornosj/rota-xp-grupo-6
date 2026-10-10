package br.com.rotaxp.copiloto.inteligencia;

import br.com.rotaxp.copiloto.config.DemoProps;
import br.com.rotaxp.copiloto.consolidacao.AnaliseCliente;
import br.com.rotaxp.copiloto.consolidacao.Visao360Assembler;
import br.com.rotaxp.copiloto.dominio.AcaoSugerida;
import br.com.rotaxp.copiloto.dominio.Cliente;
import br.com.rotaxp.copiloto.dominio.ClienteResumo;
import br.com.rotaxp.copiloto.dominio.ItemFila;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;

/** Fila "Hoje": clientes do assessor ordenados pela prioridade (PLAN §7.9). Sem LLM no caminho. */
@Service
public class FilaService {

    private final Visao360Assembler assembler;
    private final DemoProps demo;

    public FilaService(Visao360Assembler assembler, DemoProps demo) {
        this.assembler = assembler;
        this.demo = demo;
    }

    private record Par(Cliente cliente, AnaliseCliente analise) {}

    private List<Par> ordenados() {
        return assembler.clientes().stream()
                .filter(c -> demo.assessorId().equals(c.assessorId()))
                .map(c -> new Par(c, assembler.analisar(c.id())))
                .sorted(Comparator.comparingDouble((Par p) -> p.analise().prioridade().prioridade()).reversed()
                        .thenComparing(p -> p.cliente().nome()))
                .toList();
    }

    public List<ItemFila> fila() {
        List<ItemFila> itens = new ArrayList<>();
        int posicao = 0;
        for (Par p : ordenados()) {
            AnaliseCliente a = p.analise();
            AcaoSugerida principal = a.acoes().stream().filter(AcaoSugerida::principal).findFirst().orElse(null);
            itens.add(new ItemFila(++posicao, p.cliente().id(), p.cliente().nome(), p.cliente().perfil(),
                    a.prioridade().prioridade(), a.prioridade().motivos(), principal,
                    a.principalidade().posicaoXp(), a.temAlertaNovo()));
        }
        return itens;
    }

    public List<ClienteResumo> resumos() {
        return ordenados().stream().map(p -> new ClienteResumo(p.cliente().id(), p.cliente().nome(), p.cliente().perfil(),
                p.analise().principalidade().posicaoXp(), p.analise().prioridade().prioridade())).toList();
    }
}
