package br.com.rotaxp.copiloto.openfinance;

import br.com.rotaxp.copiloto.config.BancoProps;
import br.com.rotaxp.copiloto.config.EsquemaSqlite;
import br.com.rotaxp.copiloto.dominio.Cliente;
import br.com.rotaxp.copiloto.dominio.Cliente.Dependente;
import br.com.rotaxp.copiloto.dominio.Cliente.InstituicaoDeclarada;
import br.com.rotaxp.copiloto.dominio.Consentimento;
import br.com.rotaxp.copiloto.dominio.Conta;
import br.com.rotaxp.copiloto.dominio.Emissor;
import br.com.rotaxp.copiloto.dominio.Enums.Escopo;
import br.com.rotaxp.copiloto.dominio.Enums.Indexador;
import br.com.rotaxp.copiloto.dominio.Enums.Modalidade;
import br.com.rotaxp.copiloto.dominio.Enums.OrigemEvento;
import br.com.rotaxp.copiloto.dominio.Enums.PerfilInvestidor;
import br.com.rotaxp.copiloto.dominio.Enums.Produto;
import br.com.rotaxp.copiloto.dominio.Enums.ProdutoDeclarado;
import br.com.rotaxp.copiloto.dominio.Enums.StatusConsentimento;
import br.com.rotaxp.copiloto.dominio.Enums.TipoConsentimento;
import br.com.rotaxp.copiloto.dominio.Enums.TipoConta;
import br.com.rotaxp.copiloto.dominio.Enums.TipoCredito;
import br.com.rotaxp.copiloto.dominio.Enums.TipoEmissor;
import br.com.rotaxp.copiloto.dominio.Enums.TipoEventoVida;
import br.com.rotaxp.copiloto.dominio.Enums.TipoTransacao;
import br.com.rotaxp.copiloto.dominio.EventoVida;
import br.com.rotaxp.copiloto.dominio.Excecoes.NaoEncontrado;
import br.com.rotaxp.copiloto.dominio.FaturaCartao;
import br.com.rotaxp.copiloto.dominio.Instituicao;
import br.com.rotaxp.copiloto.dominio.OperacaoCredito;
import br.com.rotaxp.copiloto.dominio.PosicaoInvestimento;
import br.com.rotaxp.copiloto.dominio.Transacao;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Repositório em SQLite (banco.tipo=sqlite, o padrão). O esquema (resources/db/schema.sql) é aplicado por EsquemaSqlite.
 * No startup cria o esquema e importa a seed se o banco estiver vazio (ou sempre, com
 * banco.recriar-no-inicio=true); {@link #recarregar()} (POST /demo/reset) apaga tudo e reimporta a seed.
 * Consentimentos e eventos de vida alterados pela demo ficam persistidos entre reinícios.
 */
@Component
@ConditionalOnProperty(name = "banco.tipo", havingValue = "sqlite", matchIfMissing = true)
public class RepositorioSqlite extends Repositorio {

    /** Ordem de exclusão respeita as chaves estrangeiras (filhas antes das mães). */
    private static final List<String> TABELAS = List.of(
            "transacao", "conta", "consentimento_escopo", "consentimento", "evento_vida", "dependente",
            "cliente_produto_declarado", "cliente_instituicao_declarada", "fatura_cartao", "operacao_credito",
            "posicao_investimento", "cliente", "emissor", "instituicao");

    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final SeedLoader loader;

    public RepositorioSqlite(EsquemaSqlite esquema, PlatformTransactionManager transacoes, SeedLoader loader, BancoProps props) {
        this.jdbc = esquema.jdbc();
        this.tx = new TransactionTemplate(transacoes);
        this.loader = loader;
        if (props.recriarNoInicio() || vazio()) {
            recarregar();
        }
    }

    private boolean vazio() {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM cliente", Integer.class);
        return n == null || n == 0;
    }

    // ---------------------------------------------------------------- escrita

    @Override
    public synchronized void recarregar() {
        Seed s = loader.carregar();
        tx.executeWithoutResult(status -> {
            TABELAS.forEach(t -> jdbc.update("DELETE FROM " + t));
            importar(s);
        });
    }

    private void importar(Seed s) {
        lote("INSERT INTO instituicao (id, nome, conglomerado_id, conglomerado_nome, eh_xp, ordem) VALUES (?, ?, ?, ?, ?, ?)",
                s.instituicoes(), (i, n) -> new Object[] {i.id(), i.nome(), i.conglomeradoId(), i.conglomeradoNome(), bit(i.ehXp()), n});
        lote("INSERT INTO emissor (id, nome, conglomerado_id, tipo, ordem) VALUES (?, ?, ?, ?, ?)",
                s.emissores(), (e, n) -> new Object[] {e.id(), e.nome(), e.conglomeradoId(), txt(e.tipo()), n});

        lote("INSERT INTO cliente (id, nome, cpf, idade, profissao, cidade, perfil, assessor_id, ancora, ordem)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                s.clientes(), (c, n) -> new Object[] {c.id(), c.nome(), c.cpf(), c.idade(), c.profissao(), c.cidade(),
                        txt(c.perfil()), c.assessorId(), bit(c.ancora()), n});
        inserirFilhosDosClientes(s.clientes());

        lote("INSERT INTO consentimento (id, cliente_id, instituicao_id, tipo, status, concedido_em, expira_em, ordem)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                s.consentimentos(), (c, n) -> new Object[] {c.id(), c.clienteId(), c.instituicaoId(), txt(c.tipo()),
                        txt(c.status()), txt(c.concedidoEm()), txt(c.expiraEm()), n});
        s.consentimentos().forEach(c -> inserirEscopos(c.id(), lista(c.escopos())));

        lote("INSERT INTO conta (id, cliente_id, instituicao_id, tipo, saldo, ordem) VALUES (?, ?, ?, ?, ?, ?)",
                s.contas(), (c, n) -> new Object[] {c.id(), c.clienteId(), c.instituicaoId(), txt(c.tipo()), txt(c.saldo()), n});
        lote("INSERT INTO transacao (id, conta_id, data, valor, tipo, modalidade, descricao, contraparte_documento,"
                        + " contraparte_nome, ordem) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                s.transacoes(), (t, n) -> new Object[] {t.id(), t.contaId(), txt(t.data()), txt(t.valor()), txt(t.tipo()),
                        txt(t.modalidade()), t.descricao(), t.contraparteDocumento(), t.contraparteNome(), n});
        lote("INSERT INTO fatura_cartao (id, cliente_id, instituicao_id, mes_referencia, valor_total, ordem) VALUES (?, ?, ?, ?, ?, ?)",
                s.faturas(), (f, n) -> new Object[] {f.id(), f.clienteId(), f.instituicaoId(), f.mesReferencia(), txt(f.valorTotal()), n});
        lote("INSERT INTO operacao_credito (id, cliente_id, instituicao_id, tipo, saldo_devedor, parcela_mensal, taxa_anual, ordem)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                s.creditos(), (c, n) -> new Object[] {c.id(), c.clienteId(), c.instituicaoId(), txt(c.tipo()),
                        txt(c.saldoDevedor()), txt(c.parcelaMensal()), txt(c.taxaAnual()), n});
        lote("INSERT INTO posicao_investimento (id, cliente_id, instituicao_id, emissor_id, produto, nome, valor_aplicado,"
                        + " valor_atual, data_aplicacao, vencimento, indexador, taxa, liquidez_diaria, ordem)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                s.investimentos(), (p, n) -> new Object[] {p.id(), p.clienteId(), p.instituicaoId(), p.emissorId(),
                        txt(p.produto()), p.nome(), txt(p.valorAplicado()), txt(p.valorAtual()), txt(p.dataAplicacao()),
                        txt(p.vencimento()), txt(p.indexador()), p.taxa(), bit(p.liquidezDiaria()), n});
    }

    /** Instituições e produtos declarados, dependentes e eventos de vida de cada cliente. */
    private void inserirFilhosDosClientes(List<Cliente> clientes) {
        List<Object[]> declaradas = new ArrayList<>();
        List<Object[]> produtos = new ArrayList<>();
        List<Object[]> dependentes = new ArrayList<>();
        for (Cliente c : clientes) {
            List<InstituicaoDeclarada> ds = lista(c.instituicoesDeclaradas());
            for (int j = 0; j < ds.size(); j++) {
                declaradas.add(new Object[] {c.id(), j, ds.get(j).instituicaoId()});
                List<ProdutoDeclarado> ps = lista(ds.get(j).produtos());
                for (int k = 0; k < ps.size(); k++) {
                    produtos.add(new Object[] {c.id(), j, k, txt(ps.get(k))});
                }
            }
            List<Dependente> deps = lista(c.dependentes());
            for (int j = 0; j < deps.size(); j++) {
                Dependente d = deps.get(j);
                dependentes.add(new Object[] {c.id(), j, d.nome(), d.parentesco(), txt(d.dataNascimento())});
            }
            inserirEventos(c.id(), lista(c.eventosVida()));
        }
        jdbc.batchUpdate("INSERT INTO cliente_instituicao_declarada (cliente_id, ordem, instituicao_id) VALUES (?, ?, ?)", declaradas);
        jdbc.batchUpdate("INSERT INTO cliente_produto_declarado (cliente_id, declaracao, ordem, produto) VALUES (?, ?, ?, ?)", produtos);
        jdbc.batchUpdate("INSERT INTO dependente (cliente_id, ordem, nome, parentesco, data_nascimento) VALUES (?, ?, ?, ?, ?)", dependentes);
    }

    @Override
    public synchronized void adicionarCliente(Cliente c) {
        tx.executeWithoutResult(status -> {
            Integer existe = jdbc.queryForObject("SELECT COUNT(*) FROM cliente WHERE id = ?", Integer.class, c.id());
            if (existe != null && existe > 0) throw new IllegalStateException("Cliente " + c.id() + " já existe");
            // Cliente novo vai para o fim da lista.
            jdbc.update("INSERT INTO cliente (id, nome, cpf, idade, profissao, cidade, perfil, assessor_id, ancora, ordem)"
                            + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(ordem), -1) + 1 FROM cliente))",
                    c.id(), c.nome(), c.cpf(), c.idade(), c.profissao(), c.cidade(), txt(c.perfil()), c.assessorId(),
                    bit(c.ancora()));
            inserirFilhosDosClientes(List.of(c));
        });
    }

    @Override
    public synchronized void adicionarEventos(String clienteId, List<EventoVida> eventos) {
        cliente(clienteId);
        tx.executeWithoutResult(status -> inserirEventos(clienteId, eventos));
    }

    @Override
    public synchronized void salvar(Consentimento c) {
        tx.executeWithoutResult(status -> {
            // Consentimento novo vai para o fim da lista; um existente mantém a posição.
            jdbc.update("INSERT INTO consentimento (id, cliente_id, instituicao_id, tipo, status, concedido_em, expira_em, ordem)"
                            + " VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(ordem), -1) + 1 FROM consentimento))"
                            + " ON CONFLICT (id) DO UPDATE SET cliente_id = excluded.cliente_id,"
                            + " instituicao_id = excluded.instituicao_id, tipo = excluded.tipo, status = excluded.status,"
                            + " concedido_em = excluded.concedido_em, expira_em = excluded.expira_em",
                    c.id(), c.clienteId(), c.instituicaoId(), txt(c.tipo()), txt(c.status()),
                    txt(c.concedidoEm()), txt(c.expiraEm()));
            jdbc.update("DELETE FROM consentimento_escopo WHERE consentimento_id = ?", c.id());
            inserirEscopos(c.id(), lista(c.escopos()));
        });
    }

    private void inserirEventos(String clienteId, List<EventoVida> eventos) {
        jdbc.batchUpdate("INSERT INTO evento_vida (id, cliente_id, tipo, descricao, data, origem) VALUES (?, ?, ?, ?, ?, ?)",
                eventos.stream().map(e -> new Object[] {e.id(), clienteId, txt(e.tipo()), e.descricao(), txt(e.data()),
                        txt(e.origem())}).toList());
    }

    private void inserirEscopos(String consentimentoId, List<Escopo> escopos) {
        List<Object[]> linhas = new ArrayList<>();
        for (int i = 0; i < escopos.size(); i++) {
            linhas.add(new Object[] {consentimentoId, i, txt(escopos.get(i))});
        }
        jdbc.batchUpdate("INSERT INTO consentimento_escopo (consentimento_id, ordem, escopo) VALUES (?, ?, ?)", linhas);
    }

    // ---------------------------------------------------------------- leitura

    @Override
    public List<Cliente> clientes() { return carregarClientes(null); }

    @Override
    public Cliente cliente(String id) {
        List<Cliente> c = carregarClientes(id);
        if (c.isEmpty()) throw new NaoEncontrado("Cliente " + id + " não encontrado");
        return c.get(0);
    }

    /** Carrega um cliente (id) ou todos (id == null) com as listas filhas, sem N+1. */
    private List<Cliente> carregarClientes(String id) {
        String onde = id == null ? "" : " WHERE cliente_id = ?";
        Object[] args = id == null ? new Object[0] : new Object[] {id};

        Map<String, Map<Integer, List<ProdutoDeclarado>>> produtos = new HashMap<>();
        jdbc.query("SELECT cliente_id, declaracao, produto FROM cliente_produto_declarado" + onde
                + " ORDER BY cliente_id, declaracao, ordem", rs -> {
            produtos.computeIfAbsent(rs.getString(1), k -> new HashMap<>())
                    .computeIfAbsent(rs.getInt(2), k -> new ArrayList<>())
                    .add(en(ProdutoDeclarado.class, rs.getString(3)));
        }, args);

        Map<String, List<InstituicaoDeclarada>> declaradas = new HashMap<>();
        jdbc.query("SELECT cliente_id, ordem, instituicao_id FROM cliente_instituicao_declarada" + onde
                + " ORDER BY cliente_id, ordem", rs -> {
            String cli = rs.getString(1);
            List<ProdutoDeclarado> ps = produtos.getOrDefault(cli, Map.of()).getOrDefault(rs.getInt(2), List.of());
            declaradas.computeIfAbsent(cli, k -> new ArrayList<>()).add(new InstituicaoDeclarada(rs.getString(3), ps));
        }, args);

        Map<String, List<Dependente>> dependentes = new HashMap<>();
        jdbc.query("SELECT cliente_id, nome, parentesco, data_nascimento FROM dependente" + onde
                + " ORDER BY cliente_id, ordem", rs -> {
            dependentes.computeIfAbsent(rs.getString(1), k -> new ArrayList<>())
                    .add(new Dependente(rs.getString(2), rs.getString(3), data(rs, "data_nascimento")));
        }, args);

        Map<String, List<EventoVida>> eventos = new HashMap<>();
        jdbc.query("SELECT cliente_id, id, tipo, descricao, data, origem FROM evento_vida" + onde + " ORDER BY seq", rs -> {
            eventos.computeIfAbsent(rs.getString(1), k -> new ArrayList<>())
                    .add(new EventoVida(rs.getString("id"), en(TipoEventoVida.class, rs.getString("tipo")),
                            rs.getString("descricao"), data(rs, "data"), en(OrigemEvento.class, rs.getString("origem"))));
        }, args);

        return jdbc.query("SELECT * FROM cliente" + (id == null ? "" : " WHERE id = ?") + " ORDER BY ordem", (rs, n) -> {
            String cli = rs.getString("id");
            return new Cliente(cli, rs.getString("nome"), rs.getString("cpf"), rs.getInt("idade"),
                    rs.getString("profissao"), rs.getString("cidade"), en(PerfilInvestidor.class, rs.getString("perfil")),
                    rs.getString("assessor_id"), rs.getInt("ancora") == 1,
                    declaradas.getOrDefault(cli, List.of()), dependentes.getOrDefault(cli, List.of()),
                    eventos.getOrDefault(cli, List.of()));
        }, args);
    }

    @Override
    public Optional<Instituicao> instituicao(String id) {
        return jdbc.query("SELECT * FROM instituicao WHERE id = ?", RepositorioSqlite::instituicao, id).stream().findFirst();
    }

    @Override
    public Map<String, Instituicao> instituicoes() {
        Map<String, Instituicao> m = new LinkedHashMap<>();
        jdbc.query("SELECT * FROM instituicao ORDER BY ordem", RepositorioSqlite::instituicao).forEach(i -> m.put(i.id(), i));
        return m;
    }

    private static Instituicao instituicao(ResultSet rs, int n) throws SQLException {
        return new Instituicao(rs.getString("id"), rs.getString("nome"), rs.getString("conglomerado_id"),
                rs.getString("conglomerado_nome"), rs.getInt("eh_xp") == 1);
    }

    @Override
    public Map<String, Emissor> emissores() {
        Map<String, Emissor> m = new LinkedHashMap<>();
        jdbc.query("SELECT * FROM emissor ORDER BY ordem", (rs, n) -> new Emissor(rs.getString("id"), rs.getString("nome"),
                rs.getString("conglomerado_id"), en(TipoEmissor.class, rs.getString("tipo")))).forEach(e -> m.put(e.id(), e));
        return m;
    }

    @Override
    public List<Consentimento> consentimentos(String clienteId) {
        Map<String, List<Escopo>> escopos = new HashMap<>();
        jdbc.query("SELECT e.consentimento_id, e.escopo FROM consentimento_escopo e"
                + " JOIN consentimento c ON c.id = e.consentimento_id WHERE c.cliente_id = ?"
                + " ORDER BY e.consentimento_id, e.ordem", rs -> {
            escopos.computeIfAbsent(rs.getString(1), k -> new ArrayList<>()).add(en(Escopo.class, rs.getString(2)));
        }, clienteId);
        return jdbc.query("SELECT * FROM consentimento WHERE cliente_id = ? ORDER BY ordem", (rs, n) -> new Consentimento(
                rs.getString("id"), rs.getString("cliente_id"), rs.getString("instituicao_id"),
                en(TipoConsentimento.class, rs.getString("tipo")), en(StatusConsentimento.class, rs.getString("status")),
                escopos.getOrDefault(rs.getString("id"), List.of()), data(rs, "concedido_em"), data(rs, "expira_em")), clienteId);
    }

    @Override
    List<Conta> contas(String clienteId) {
        return jdbc.query("SELECT * FROM conta WHERE cliente_id = ? ORDER BY ordem", (rs, n) -> new Conta(
                rs.getString("id"), rs.getString("cliente_id"), rs.getString("instituicao_id"),
                en(TipoConta.class, rs.getString("tipo")), dec(rs, "saldo")), clienteId);
    }

    @Override
    List<Transacao> transacoes(String contaId) {
        return jdbc.query("SELECT * FROM transacao WHERE conta_id = ? ORDER BY ordem", (rs, n) -> new Transacao(
                rs.getString("id"), rs.getString("conta_id"), data(rs, "data"), dec(rs, "valor"),
                en(TipoTransacao.class, rs.getString("tipo")), en(Modalidade.class, rs.getString("modalidade")),
                rs.getString("descricao"), rs.getString("contraparte_documento"), rs.getString("contraparte_nome")), contaId);
    }

    @Override
    List<FaturaCartao> faturas(String clienteId) {
        return jdbc.query("SELECT * FROM fatura_cartao WHERE cliente_id = ? ORDER BY ordem", (rs, n) -> new FaturaCartao(
                rs.getString("id"), rs.getString("cliente_id"), rs.getString("instituicao_id"),
                rs.getString("mes_referencia"), dec(rs, "valor_total")), clienteId);
    }

    @Override
    List<OperacaoCredito> creditos(String clienteId) {
        return jdbc.query("SELECT * FROM operacao_credito WHERE cliente_id = ? ORDER BY ordem", (rs, n) -> new OperacaoCredito(
                rs.getString("id"), rs.getString("cliente_id"), rs.getString("instituicao_id"),
                en(TipoCredito.class, rs.getString("tipo")), dec(rs, "saldo_devedor"), dec(rs, "parcela_mensal"),
                dec(rs, "taxa_anual")), clienteId);
    }

    @Override
    List<PosicaoInvestimento> investimentos(String clienteId) {
        return jdbc.query("SELECT * FROM posicao_investimento WHERE cliente_id = ? ORDER BY ordem", (rs, n) -> new PosicaoInvestimento(
                rs.getString("id"), rs.getString("cliente_id"), rs.getString("instituicao_id"), rs.getString("emissor_id"),
                en(Produto.class, rs.getString("produto")), rs.getString("nome"), dec(rs, "valor_aplicado"),
                dec(rs, "valor_atual"), data(rs, "data_aplicacao"), data(rs, "vencimento"),
                en(Indexador.class, rs.getString("indexador")), rs.getString("taxa"), rs.getInt("liquidez_diaria") == 1), clienteId);
    }

    // ---------------------------------------------------------------- conversões

    private interface Linha<T> { Object[] de(T item, int ordem); }

    private <T> void lote(String sql, List<T> itens, Linha<T> linha) {
        List<Object[]> linhas = new ArrayList<>(itens.size());
        for (int i = 0; i < itens.size(); i++) {
            linhas.add(linha.de(itens.get(i), i));
        }
        jdbc.batchUpdate(sql, linhas);
    }

    private static <T> List<T> lista(List<T> l) { return l == null ? List.of() : l; }

    private static int bit(boolean b) { return b ? 1 : 0; }

    private static String txt(BigDecimal v) { return v == null ? null : v.toPlainString(); }

    private static String txt(LocalDate d) { return d == null ? null : d.toString(); }

    private static String txt(Enum<?> e) { return e == null ? null : e.name(); }

    private static BigDecimal dec(ResultSet rs, String coluna) throws SQLException {
        String s = rs.getString(coluna);
        return s == null ? null : new BigDecimal(s);
    }

    private static LocalDate data(ResultSet rs, String coluna) throws SQLException {
        String s = rs.getString(coluna);
        return s == null ? null : LocalDate.parse(s);
    }

    private static <E extends Enum<E>> E en(Class<E> tipo, String s) { return s == null ? null : Enum.valueOf(tipo, s); }
}
