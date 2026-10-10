package br.com.rotaxp.copiloto.demo;

import br.com.rotaxp.copiloto.config.BancoProps;
import br.com.rotaxp.copiloto.config.EsquemaSqlite;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Registro de alertas na tabela registro_alerta (persiste entre reinícios; o reset da demo limpa). */
@Component
@ConditionalOnProperty(name = "banco.tipo", havingValue = "sqlite", matchIfMissing = true)
public class ArmazemAlertasSqlite implements ArmazemAlertas {

    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;

    public ArmazemAlertasSqlite(EsquemaSqlite esquema, PlatformTransactionManager transacoes, BancoProps props) {
        this.jdbc = esquema.jdbc();
        this.tx = new TransactionTemplate(transacoes);
        if (props.recriarNoInicio()) {
            limpar();
        }
    }

    @Override
    public Map<String, Registro> carregar() {
        Map<String, Registro> m = new HashMap<>();
        jdbc.query("SELECT chave, instante, detectado_em, linha_de_base FROM registro_alerta", rs -> {
            m.put(rs.getString(1), new Registro(Instant.parse(rs.getString(2)), OffsetDateTime.parse(rs.getString(3)),
                    rs.getInt(4) == 1));
        });
        return m;
    }

    @Override
    public void salvar(Map<String, Registro> novos) {
        if (novos.isEmpty()) return;
        List<Object[]> linhas = novos.entrySet().stream().map(e -> new Object[] {e.getKey(),
                e.getValue().instante().toString(), e.getValue().detectadoEm().toString(),
                e.getValue().linhaDeBase() ? 1 : 0}).toList();
        tx.executeWithoutResult(status -> jdbc.batchUpdate(
                "INSERT OR IGNORE INTO registro_alerta (chave, instante, detectado_em, linha_de_base) VALUES (?, ?, ?, ?)",
                linhas));
    }

    @Override
    public void limpar() { jdbc.update("DELETE FROM registro_alerta"); }
}
