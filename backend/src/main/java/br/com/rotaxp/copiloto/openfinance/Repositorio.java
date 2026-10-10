package br.com.rotaxp.copiloto.openfinance;

import br.com.rotaxp.copiloto.dominio.Cliente;
import br.com.rotaxp.copiloto.dominio.Consentimento;
import br.com.rotaxp.copiloto.dominio.Conta;
import br.com.rotaxp.copiloto.dominio.Emissor;
import br.com.rotaxp.copiloto.dominio.EventoVida;
import br.com.rotaxp.copiloto.dominio.Excecoes.NaoEncontrado;
import br.com.rotaxp.copiloto.dominio.FaturaCartao;
import br.com.rotaxp.copiloto.dominio.Instituicao;
import br.com.rotaxp.copiloto.dominio.OperacaoCredito;
import br.com.rotaxp.copiloto.dominio.PosicaoInvestimento;
import br.com.rotaxp.copiloto.dominio.Transacao;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Repositório em memória. Os dados crus só podem ser lidos pela camada analise através do
 * OpenFinanceGateway — este repositório é do pacote openfinance.
 */
@Component
public class Repositorio {

    private final SeedLoader loader;
    private volatile Estado estado;

    private record Estado(
            Map<String, Instituicao> instituicoes, Map<String, Emissor> emissores,
            Map<String, Cliente> clientes, Map<String, Consentimento> consentimentos,
            Map<String, List<Conta>> contasPorCliente, Map<String, List<Transacao>> transacoesPorConta,
            Map<String, List<FaturaCartao>> faturasPorCliente, Map<String, List<OperacaoCredito>> creditosPorCliente,
            Map<String, List<PosicaoInvestimento>> investimentosPorCliente) {}

    public Repositorio(SeedLoader loader) {
        this.loader = loader;
        recarregar();
    }

    public synchronized void recarregar() {
        Seed s = loader.carregar();
        estado = new Estado(
                porId(s.instituicoes(), Instituicao::id),
                porId(s.emissores(), Emissor::id),
                porId(s.clientes(), Cliente::id),
                new LinkedHashMap<>(porId(s.consentimentos(), Consentimento::id)),
                agrupar(s.contas(), Conta::clienteId),
                agrupar(s.transacoes(), Transacao::contaId),
                agrupar(s.faturas(), FaturaCartao::clienteId),
                agrupar(s.creditos(), OperacaoCredito::clienteId),
                agrupar(s.investimentos(), PosicaoInvestimento::clienteId));
    }

    private static <T> Map<String, T> porId(List<T> lista, Function<T, String> id) {
        Map<String, T> m = new LinkedHashMap<>();
        lista.forEach(x -> m.put(id.apply(x), x));
        return m;
    }

    private static <T> Map<String, List<T>> agrupar(List<T> lista, Function<T, String> chave) {
        return lista.stream().collect(Collectors.groupingBy(chave, LinkedHashMap::new, Collectors.toList()));
    }

    public List<Cliente> clientes() { return List.copyOf(estado.clientes().values()); }

    public Cliente cliente(String id) {
        Cliente c = estado.clientes().get(id);
        if (c == null) throw new NaoEncontrado("Cliente " + id + " não encontrado");
        return c;
    }

    public synchronized void adicionarEventos(String clienteId, List<EventoVida> eventos) {
        Cliente c = cliente(clienteId);
        List<EventoVida> todos = new ArrayList<>(c.eventosVida() == null ? List.of() : c.eventosVida());
        todos.addAll(eventos);
        estado.clientes().put(clienteId, c.comEventos(todos));
    }

    public Optional<Instituicao> instituicao(String id) { return Optional.ofNullable(estado.instituicoes().get(id)); }

    public Map<String, Instituicao> instituicoes() { return estado.instituicoes(); }

    public Map<String, Emissor> emissores() { return estado.emissores(); }

    public List<Consentimento> consentimentos(String clienteId) {
        return estado.consentimentos().values().stream().filter(c -> c.clienteId().equals(clienteId)).toList();
    }

    public synchronized void salvar(Consentimento c) { estado.consentimentos().put(c.id(), c); }

    // Acesso cru — usado apenas pelo OpenFinanceGateway.
    List<Conta> contas(String clienteId) { return estado.contasPorCliente().getOrDefault(clienteId, List.of()); }

    List<Transacao> transacoes(String contaId) { return estado.transacoesPorConta().getOrDefault(contaId, List.of()); }

    List<FaturaCartao> faturas(String clienteId) { return estado.faturasPorCliente().getOrDefault(clienteId, List.of()); }

    List<OperacaoCredito> creditos(String clienteId) { return estado.creditosPorCliente().getOrDefault(clienteId, List.of()); }

    List<PosicaoInvestimento> investimentos(String clienteId) {
        return estado.investimentosPorCliente().getOrDefault(clienteId, List.of());
    }
}
