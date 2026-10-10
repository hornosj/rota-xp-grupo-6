package br.com.rotaxp.copiloto.support;

import br.com.rotaxp.copiloto.config.ConsentimentoProps;
import br.com.rotaxp.copiloto.config.DemoProps;
import br.com.rotaxp.copiloto.demo.DataReferencia;
import br.com.rotaxp.copiloto.openfinance.ConsentimentoService;
import br.com.rotaxp.copiloto.openfinance.OpenFinanceGateway;
import br.com.rotaxp.copiloto.openfinance.Repositorio;
import br.com.rotaxp.copiloto.openfinance.Seed;
import br.com.rotaxp.copiloto.openfinance.SeedLoader;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** Infraestrutura sem Spring para testes unitários. */
public final class Infra {

    public final Repositorio repo;
    public final OpenFinanceGateway gateway;
    public final DataReferencia dataReferencia;
    public final ConsentimentoService consentimentos;
    public final List<Object> eventos = new ArrayList<>();

    public Infra(Seed seed) {
        this.repo = new Repositorio(new SeedLoader(new ObjectMapper()) {
            @Override public Seed carregar() { return seed; }
        });
        this.gateway = new OpenFinanceGateway(repo);
        this.dataReferencia = new DataReferencia(CenarioBuilder.REF,
                Clock.fixed(Instant.parse("2026-10-11T12:00:00Z"), DataReferencia.ZONA));
        this.consentimentos = new ConsentimentoService(repo, dataReferencia, new ConsentimentoProps(365), eventos::add);
    }

    public static DemoProps demoProps() {
        return new DemoProps(CenarioBuilder.REF, "ass-001", 10);
    }
}
