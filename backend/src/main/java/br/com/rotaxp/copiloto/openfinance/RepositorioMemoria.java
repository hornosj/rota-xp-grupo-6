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
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Repositório em memória (banco.tipo=memoria). Também usado pelos testes unitários sem Spring. */
@Component
@ConditionalOnProperty(name = "banco.tipo", havingValue = "memoria")
public class RepositorioMemoria extends Repositorio {

    private final SeedLoader loader;
    private volatile Estado estado;

    private record Estado(
            Map<String, Instituicao> instituicoes, Map<String, Emissor> emissores,
            Map<String, Cliente> clientes, Map<String, Consentimento> consentimentos,
            Map<String, List<Conta>> contasPorCliente, Map<String, List<Transacao>> transacoesPorConta,
            Map<String, List<FaturaCartao>> faturasPorCliente, Map<String, List<OperacaoCredito>> creditosPorCliente,
            Map<String, List<PosicaoInvestimento>> investimentosPorCliente) {}

    public RepositorioMemoria(SeedLoader loader) {
        this.loader = loader;
        recarregar();
    }

    @Override
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

    @Override
    public List<Cliente> clientes() { return List.copyOf(estado.clientes().values()); }

    @Override
    public Cliente cliente(String id) {
        Cliente c = estado.clientes().get(id);
        if (c == null) throw new NaoEncontrado("Cliente " + id + " não encontrado");
        return c;
    }

    @Override
    public synchronized void adicionarCliente(Cliente c) {
        if (estado.clientes().containsKey(c.id())) throw new IllegalStateException("Cliente " + c.id() + " já existe");
        estado.clientes().put(c.id(), c);
    }

    @Override
    public synchronized void adicionarEventos(String clienteId, List<EventoVida> eventos) {
        Cliente c = cliente(clienteId);
        List<EventoVida> todos = new ArrayList<>(c.eventosVida() == null ? List.of() : c.eventosVida());
        todos.addAll(eventos);
        estado.clientes().put(clienteId, c.comEventos(todos));
    }

    @Override
    public synchronized void salvarCadastro(Cliente novo) {
        Cliente c = cliente(novo.id());
        estado.clientes().put(c.id(), c.comCadastro(novo.nome(), novo.idade(), novo.profissao(), novo.cidade()));
    }

    @Override
    public Optional<Instituicao> instituicao(String id) { return Optional.ofNullable(estado.instituicoes().get(id)); }

    @Override
    public Map<String, Instituicao> instituicoes() { return estado.instituicoes(); }

    @Override
    public Map<String, Emissor> emissores() { return estado.emissores(); }

    @Override
    public List<Consentimento> consentimentos(String clienteId) {
        return estado.consentimentos().values().stream().filter(c -> c.clienteId().equals(clienteId)).toList();
    }

    @Override
    public synchronized void salvar(Consentimento c) { estado.consentimentos().put(c.id(), c); }

    @Override
    List<Conta> contas(String clienteId) { return estado.contasPorCliente().getOrDefault(clienteId, List.of()); }

    @Override
    List<Transacao> transacoes(String contaId) { return estado.transacoesPorConta().getOrDefault(contaId, List.of()); }

    @Override
    List<FaturaCartao> faturas(String clienteId) { return estado.faturasPorCliente().getOrDefault(clienteId, List.of()); }

    @Override
    List<OperacaoCredito> creditos(String clienteId) { return estado.creditosPorCliente().getOrDefault(clienteId, List.of()); }

    @Override
    List<PosicaoInvestimento> investimentos(String clienteId) {
        return estado.investimentosPorCliente().getOrDefault(clienteId, List.of());
    }
}
