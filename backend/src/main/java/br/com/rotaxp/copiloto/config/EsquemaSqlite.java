package br.com.rotaxp.copiloto.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Component;

/**
 * Aplica resources/db/schema.sql (idempotente) ao subir. Quem usa o banco recebe este bean no construtor,
 * o que garante que as tabelas existem antes do primeiro acesso.
 */
@Component
@ConditionalOnProperty(name = "banco.tipo", havingValue = "sqlite", matchIfMissing = true)
public class EsquemaSqlite {

    private final JdbcTemplate jdbc;

    public EsquemaSqlite(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
        new ResourceDatabasePopulator(new ClassPathResource("db/schema.sql")).execute(jdbc.getDataSource());
    }

    public JdbcTemplate jdbc() { return jdbc; }
}
