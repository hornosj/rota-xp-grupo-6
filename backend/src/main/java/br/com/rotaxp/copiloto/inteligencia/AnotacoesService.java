package br.com.rotaxp.copiloto.inteligencia;

import br.com.rotaxp.copiloto.config.AnotacoesProps;
import br.com.rotaxp.copiloto.dominio.ContextoAssessor;
import br.com.rotaxp.copiloto.dominio.ContextoAssessor.Anotacao;
import br.com.rotaxp.copiloto.dominio.Enums.OrigemAnotacao;
import br.com.rotaxp.copiloto.dominio.Enums.TipoNecessidade;
import br.com.rotaxp.copiloto.dominio.RecomendacaoProduto;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.stereotype.Service;

/** Notas do assessor por cliente, em memória (zera no reset da demo). */
@Service
public class AnotacoesService {

    private final AnotacoesProps props;
    private final Map<String, List<Anotacao>> anotacoes = new ConcurrentHashMap<>();
    private final Map<String, LinkedHashMap<TipoNecessidade, RecomendacaoProduto>> recomendacoes = new ConcurrentHashMap<>();
    private final AtomicInteger sequencia = new AtomicInteger();

    public AnotacoesService(AnotacoesProps props) {
        this.props = props;
    }

    public synchronized Anotacao registrar(String clienteId, String texto, OrigemAnotacao origem, LocalDate data, String resumo,
                                           List<RecomendacaoProduto> novas) {
        Anotacao a = new Anotacao("anot-" + clienteId + "-" + sequencia.incrementAndGet(), texto, origem, data, resumo);
        anotacoes.computeIfAbsent(clienteId, k -> new ArrayList<>()).add(a);
        LinkedHashMap<TipoNecessidade, RecomendacaoProduto> antigas = recomendacoes.getOrDefault(clienteId, new LinkedHashMap<>());
        LinkedHashMap<TipoNecessidade, RecomendacaoProduto> recs = new LinkedHashMap<>();   // as da nota nova vêm na frente
        for (RecomendacaoProduto r : novas) {
            RecomendacaoProduto antiga = antigas.get(r.necessidade());
            // "já tem seguro" dito antes continua valendo se a nota nova não falar disso
            recs.putIfAbsent(r.necessidade(), antiga != null && antiga.revisao() && !r.revisao() ? antiga : r);
        }
        antigas.forEach(recs::putIfAbsent);
        recomendacoes.put(clienteId, recs);
        return a;
    }

    public synchronized ContextoAssessor contexto(String clienteId) {
        return new ContextoAssessor(clienteId, anotacoes.getOrDefault(clienteId, List.of()).reversed().stream().toList(),
                recomendacoes.getOrDefault(clienteId, new LinkedHashMap<>()).values().stream()
                        .sorted(Comparator.comparing(r -> !r.sensivel())).toList());   // momento delicado primeiro
    }

    /** As últimas notas, em ordem cronológica, para o contexto do LLM. */
    public synchronized List<String> textosRecentes(String clienteId) {
        List<Anotacao> todas = anotacoes.getOrDefault(clienteId, List.of());
        return todas.subList(Math.max(0, todas.size() - props.maxNoContexto()), todas.size()).stream().map(Anotacao::texto).toList();
    }

    public synchronized void limpar() {
        anotacoes.clear();
        recomendacoes.clear();
        sequencia.set(0);
    }
}
