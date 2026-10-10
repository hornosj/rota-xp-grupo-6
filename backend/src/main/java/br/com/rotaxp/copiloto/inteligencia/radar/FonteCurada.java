package br.com.rotaxp.copiloto.inteligencia.radar;

import br.com.rotaxp.copiloto.dominio.Enums.Indexador;
import br.com.rotaxp.copiloto.dominio.Enums.Produto;
import br.com.rotaxp.copiloto.dominio.Radar.Classificacao;
import br.com.rotaxp.copiloto.dominio.Radar.DirecaoNoticia;
import br.com.rotaxp.copiloto.dominio.Radar.Noticia;
import br.com.rotaxp.copiloto.dominio.Radar.OrigemClassificacao;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/** Notícias curadas (fictícias) em resources/noticias/curadas.json, com gabarito de classificação. */
@Component
public class FonteCurada implements FonteNoticias {

    private record Referencia(List<String> emissores, List<Indexador> indexadores, List<Produto> produtos,
                              DirecaoNoticia direcao, double relevancia, String resumoImpacto) {}

    private record Item(String id, String fonte, String titulo, String resumo, String url, OffsetDateTime publicadaEm,
                        Referencia referencia) {}

    private final ObjectMapper mapper;

    public FonteCurada(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public List<NoticiaColetada> coletar() {
        try (InputStream in = new ClassPathResource("noticias/curadas.json").getInputStream()) {
            return Arrays.stream(mapper.readValue(in, Item[].class)).map(FonteCurada::converter).toList();
        } catch (IOException e) {
            throw new UncheckedIOException("Falha ao ler noticias/curadas.json", e);
        }
    }

    private static NoticiaColetada converter(Item i) {
        Referencia r = i.referencia();
        Classificacao c = r == null ? null : new Classificacao(r.emissores(), r.indexadores(), r.produtos(), r.direcao(),
                r.relevancia(), r.resumoImpacto(), OrigemClassificacao.REFERENCIA);
        return new NoticiaColetada(new Noticia(i.id(), i.fonte(), i.titulo(), i.resumo(), i.url(), i.publicadaEm()), c);
    }
}
