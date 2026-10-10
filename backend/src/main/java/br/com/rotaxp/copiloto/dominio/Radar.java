package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.GeradoPor;
import br.com.rotaxp.copiloto.dominio.Enums.Indexador;
import br.com.rotaxp.copiloto.dominio.Enums.Produto;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/** Radar de notícias (BE2-10): tipos da API. Mudança aditiva no contrato. */
public final class Radar {

    private Radar() {}

    public enum DirecaoNoticia { POSITIVA, NEGATIVA, NEUTRA }

    /** De onde veio a classificação: gabarito curado, regras ou LLM. */
    public enum OrigemClassificacao { REFERENCIA, REGRAS, LLM }

    public record Noticia(String id, String fonte, String titulo, String resumo, String url, OffsetDateTime publicadaEm) {}

    public record Classificacao(
            List<String> emissores, List<Indexador> indexadores, List<Produto> produtos,
            DirecaoNoticia direcao, double relevancia, String resumoImpacto, OrigemClassificacao origem) {}

    public record NoticiaClassificada(Noticia noticia, Classificacao classificacao) {}

    /** Uma notícia que mexe na carteira visível de um cliente. Calculado por regra, sem LLM. */
    public record ImpactoNoticia(
            String clienteId, String clienteNome, String noticiaId, String titulo, String fonte, DirecaoNoticia direcao,
            double pontos, BigDecimal valorExposto, double fracaoPatrimonio, String motivo, List<String> gatilhos) {}

    public record MotivoNoticia(String texto, GeradoPor geradoPor) {}

    public record ResultadoProcessamento(int coletadas, int novas, int classificadasPorLlm, int classificadasPorRegra,
                                         int lotes, OffsetDateTime processadoEm) {}
}
