package br.com.rotaxp.copiloto.openfinance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.rotaxp.copiloto.config.BancoProps;
import br.com.rotaxp.copiloto.config.EsquemaSqlite;
import br.com.rotaxp.copiloto.dominio.Cliente;
import br.com.rotaxp.copiloto.dominio.Consentimento;
import br.com.rotaxp.copiloto.dominio.Enums.Escopo;
import br.com.rotaxp.copiloto.dominio.Enums.OrigemEvento;
import br.com.rotaxp.copiloto.dominio.Enums.StatusConsentimento;
import br.com.rotaxp.copiloto.dominio.Enums.TipoConsentimento;
import br.com.rotaxp.copiloto.dominio.Enums.TipoEventoVida;
import br.com.rotaxp.copiloto.dominio.EventoVida;
import br.com.rotaxp.copiloto.dominio.Excecoes.NaoEncontrado;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

/** O RepositorioSqlite precisa devolver exatamente o mesmo que o RepositorioMemoria para a seed real. */
class RepositorioSqliteTest {

    @TempDir Path dir;

    private SeedLoader loader;
    private RepositorioMemoria memoria;
    private DriverManagerDataSource ds;

    @BeforeEach
    void setUp() {
        loader = new SeedLoader(new ObjectMapper().findAndRegisterModules());
        memoria = new RepositorioMemoria(loader);
        ds = new DriverManagerDataSource("jdbc:sqlite:" + dir.resolve("teste.db") + "?foreign_keys=on");
    }

    private RepositorioSqlite sqlite(boolean recriar) {
        return new RepositorioSqlite(new EsquemaSqlite(new JdbcTemplate(ds)), new DataSourceTransactionManager(ds), loader,
                new BancoProps("sqlite", recriar));
    }

    @Test
    void seedImportadaEhIdenticaAoRepositorioEmMemoria() {
        RepositorioSqlite repo = sqlite(false);

        assertThat(repo.instituicoes()).containsExactlyEntriesOf(memoria.instituicoes());
        assertThat(repo.emissores()).containsExactlyEntriesOf(memoria.emissores());
        assertThat(repo.clientes()).containsExactlyElementsOf(memoria.clientes());
        for (Cliente c : memoria.clientes()) {
            assertThat(repo.cliente(c.id())).isEqualTo(c);
            assertThat(repo.consentimentos(c.id())).containsExactlyElementsOf(memoria.consentimentos(c.id()));
            assertThat(repo.contas(c.id())).containsExactlyElementsOf(memoria.contas(c.id()));
            memoria.contas(c.id()).forEach(conta ->
                    assertThat(repo.transacoes(conta.id())).containsExactlyElementsOf(memoria.transacoes(conta.id())));
            assertThat(repo.faturas(c.id())).containsExactlyElementsOf(memoria.faturas(c.id()));
            assertThat(repo.creditos(c.id())).containsExactlyElementsOf(memoria.creditos(c.id()));
            assertThat(repo.investimentos(c.id())).containsExactlyElementsOf(memoria.investimentos(c.id()));
        }
    }

    @Test
    void clienteInexistenteLancaNaoEncontrado() {
        assertThatThrownBy(() -> sqlite(false).cliente("cli-999")).isInstanceOf(NaoEncontrado.class);
    }

    @Test
    void alteracoesPersistemEntreInstanciasEResetVoltaParaASeed() {
        RepositorioSqlite repo = sqlite(false);
        Consentimento original = repo.consentimentos("cli-001").get(0);
        Consentimento revogado = original.com(StatusConsentimento.REVOGADO, List.of(Escopo.CONTAS),
                original.concedidoEm(), original.expiraEm());
        Consentimento novo = new Consentimento("cons-teste", "cli-001", "inst-xp", TipoConsentimento.OPEN_FINANCE,
                StatusConsentimento.ATIVO, List.of(Escopo.INVESTIMENTOS), LocalDate.of(2026, 10, 11), LocalDate.of(2027, 10, 11));
        EventoVida evento = new EventoVida("ev-teste", TipoEventoVida.FERIAS, "Viagem", LocalDate.of(2026, 12, 20),
                OrigemEvento.NOTA_REUNIAO);
        repo.salvar(revogado);
        repo.salvar(novo);
        repo.adicionarEventos("cli-001", List.of(evento));

        RepositorioSqlite reaberto = sqlite(false);
        List<Consentimento> cons = reaberto.consentimentos("cli-001");
        assertThat(cons.get(0)).isEqualTo(revogado);
        assertThat(cons.get(cons.size() - 1)).isEqualTo(novo);
        assertThat(reaberto.cliente("cli-001").eventosVida()).endsWith(evento);

        reaberto.recarregar();
        assertThat(reaberto.consentimentos("cli-001")).containsExactlyElementsOf(memoria.consentimentos("cli-001"));
        assertThat(reaberto.cliente("cli-001")).isEqualTo(memoria.cliente("cli-001"));
    }

    @Test
    void salvarCadastroMudaSoOsCamposDoCadastroIgualNosDoisRepositorios() {
        RepositorioSqlite repo = sqlite(false);
        Cliente original = repo.cliente("cli-004");
        Cliente editado = original.comCadastro("Patrícia Gomes Silva", 69, "Consultora educacional", "Campinas/SP");

        repo.salvarCadastro(editado);
        memoria.salvarCadastro(editado);

        Cliente relido = sqlite(false).cliente("cli-004");
        assertThat(relido).isEqualTo(editado).isEqualTo(memoria.cliente("cli-004"));
        assertThat(relido.perfil()).isEqualTo(original.perfil());
        assertThat(relido.instituicoesDeclaradas()).isEqualTo(original.instituicoesDeclaradas());
        assertThat(repo.clientes().indexOf(relido)).isEqualTo(new RepositorioMemoria(loader).clientes().indexOf(original));

        repo.recarregar();
        assertThat(repo.cliente("cli-004")).isEqualTo(original);
    }

    @Test
    void salvarCadastroDeClienteInexistenteLancaNaoEncontrado() {
        Cliente fantasma = memoria.cliente("cli-004").comCadastro("X Y", 30, "p", "c");
        Cliente outroId = new Cliente("cli-999", fantasma.nome(), fantasma.cpf(), 30, "p", "c", fantasma.perfil(),
                fantasma.assessorId(), false, List.of(), List.of(), List.of());

        assertThatThrownBy(() -> sqlite(false).salvarCadastro(outroId)).isInstanceOf(NaoEncontrado.class);
        assertThatThrownBy(() -> memoria.salvarCadastro(outroId)).isInstanceOf(NaoEncontrado.class);
    }

    @Test
    void recriarNoInicioDescartaAlteracoes() {
        sqlite(false).adicionarEventos("cli-001", List.of(
                new EventoVida("ev-x", TipoEventoVida.OUTRO, "x", LocalDate.of(2026, 10, 11), OrigemEvento.NOTA_REUNIAO)));

        assertThat(sqlite(true).cliente("cli-001")).isEqualTo(memoria.cliente("cli-001"));
    }
}
