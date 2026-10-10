package br.com.rotaxp.copiloto.demo;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotaxp.copiloto.config.BancoProps;
import br.com.rotaxp.copiloto.config.EsquemaSqlite;
import br.com.rotaxp.copiloto.demo.RegistroAlertasTest.RelogioMovel;
import br.com.rotaxp.copiloto.dominio.Alerta;
import br.com.rotaxp.copiloto.dominio.Enums.Severidade;
import br.com.rotaxp.copiloto.dominio.Enums.TipoAlerta;
import br.com.rotaxp.copiloto.support.CenarioBuilder;
import br.com.rotaxp.copiloto.support.Infra;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

/** O RegistroAlertas sobre SQLite lembra o que já foi detectado depois de reiniciar. */
class ArmazemAlertasSqliteTest {

    @TempDir Path dir;

    private final RelogioMovel relogio = new RelogioMovel();
    private DriverManagerDataSource ds;

    @BeforeEach
    void setUp() {
        ds = new DriverManagerDataSource("jdbc:sqlite:" + dir.resolve("alertas.db"));
    }

    private RegistroAlertas registro(boolean recriar) {
        ArmazemAlertasSqlite armazem = new ArmazemAlertasSqlite(new EsquemaSqlite(new JdbcTemplate(ds)),
                new DataSourceTransactionManager(ds), new BancoProps("sqlite", recriar));
        return new RegistroAlertas(new DataReferencia(CenarioBuilder.REF, relogio), Infra.demoProps(), armazem);
    }

    private static Alerta alerta(TipoAlerta tipo) {
        return new Alerta("a", "cli-001", tipo, Severidade.ALTA, "t", "e", null, "inst-horizonte", null, null, false);
    }

    @Test
    void registroSobreviveAoReinicio() {
        RegistroAlertas antes = registro(false);
        antes.iniciarLinhaDeBase();
        Alerta base = antes.marcar(List.of(alerta(TipoAlerta.SALDO_PARADO))).get(0);
        antes.encerrarLinhaDeBase();
        Alerta novo = antes.marcar(List.of(alerta(TipoAlerta.FGC_EXCEDIDO))).get(0);

        relogio.agora = relogio.agora.plus(Duration.ofMinutes(5));
        RegistroAlertas depois = registro(false);
        List<Alerta> marcados = depois.marcar(List.of(alerta(TipoAlerta.SALDO_PARADO), alerta(TipoAlerta.FGC_EXCEDIDO)));

        assertThat(marcados.get(0).detectadoEm()).isEqualTo(base.detectadoEm());
        assertThat(marcados.get(0).novo()).isFalse();
        assertThat(marcados.get(1).detectadoEm()).isEqualTo(novo.detectadoEm());
        assertThat(marcados.get(1).novo()).isTrue();
    }

    @Test
    void limparERecriarNoInicioApagamORegistro() {
        RegistroAlertas r = registro(false);
        r.iniciarLinhaDeBase();
        r.marcar(List.of(alerta(TipoAlerta.SALDO_PARADO)));
        r.encerrarLinhaDeBase();

        assertThat(registro(true).marcar(List.of(alerta(TipoAlerta.SALDO_PARADO))).get(0).novo()).isTrue();

        RegistroAlertas outro = registro(false);
        outro.limpar();
        assertThat(registro(false).marcar(List.of(alerta(TipoAlerta.FGC_EXCEDIDO))).get(0).novo()).isTrue();
        assertThat(new JdbcTemplate(ds).queryForObject("SELECT COUNT(*) FROM registro_alerta", Integer.class)).isEqualTo(1);
    }
}
