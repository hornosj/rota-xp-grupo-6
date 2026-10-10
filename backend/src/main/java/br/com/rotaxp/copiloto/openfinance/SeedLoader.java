package br.com.rotaxp.copiloto.openfinance;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.type.CollectionType;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.List;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/** Lê os JSON de resources/seed (gerados por data/gerar_seed.py). */
@Component
public class SeedLoader {

    private final ObjectMapper mapper;

    public SeedLoader(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public Seed carregar() {
        return new Seed(
                ler("instituicoes", br.com.rotaxp.copiloto.dominio.Instituicao.class),
                ler("emissores", br.com.rotaxp.copiloto.dominio.Emissor.class),
                ler("clientes", br.com.rotaxp.copiloto.dominio.Cliente.class),
                ler("consentimentos", br.com.rotaxp.copiloto.dominio.Consentimento.class),
                ler("contas", br.com.rotaxp.copiloto.dominio.Conta.class),
                ler("transacoes", br.com.rotaxp.copiloto.dominio.Transacao.class),
                ler("faturas", br.com.rotaxp.copiloto.dominio.FaturaCartao.class),
                ler("creditos", br.com.rotaxp.copiloto.dominio.OperacaoCredito.class),
                ler("investimentos", br.com.rotaxp.copiloto.dominio.PosicaoInvestimento.class));
    }

    private <T> List<T> ler(String nome, Class<T> tipo) {
        ClassPathResource recurso = new ClassPathResource("seed/" + nome + ".json");
        if (!recurso.exists()) {
            return List.of();
        }
        CollectionType listType = mapper.getTypeFactory().constructCollectionType(List.class, tipo);
        try (InputStream in = recurso.getInputStream()) {
            return List.copyOf(mapper.<List<T>>readValue(in, listType));
        } catch (IOException e) {
            throw new UncheckedIOException("Falha ao ler seed/" + nome + ".json", e);
        }
    }
}
