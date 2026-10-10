package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.GeradoPor;
import java.util.List;

/**
 * Resultado da nota do assessor. O Copiloto preenche as necessidades; as recomendações saem do
 * catálogo, por regra, no NotaService.
 */
public record ResultadoNota(
        String resumo, List<EventoVida> eventosCriados, List<String> metas,
        List<String> mudancasPerfil, List<Necessidade> necessidades, List<RecomendacaoProduto> recomendacoes,
        List<AcaoSugerida> acoesCriadas, GeradoPor geradoPor) {

    public ResultadoNota {
        necessidades = necessidades == null ? List.of() : necessidades;       // respostas gravadas antes do campo
        recomendacoes = recomendacoes == null ? List.of() : recomendacoes;
    }

    public ResultadoNota com(GeradoPor g) {
        return new ResultadoNota(resumo, eventosCriados, metas, mudancasPerfil, necessidades, recomendacoes, acoesCriadas, g);
    }

    public ResultadoNota comRecomendacoes(List<RecomendacaoProduto> r) {
        return new ResultadoNota(resumo, eventosCriados, metas, mudancasPerfil, necessidades, r, acoesCriadas, geradoPor);
    }
}
