package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.OrigemAnotacao;
import java.time.LocalDate;
import java.util.List;

/** O que o assessor contou sobre o cliente (notas de áudio ou texto) e os produtos que isso sugere. */
public record ContextoAssessor(String clienteId, List<Anotacao> anotacoes, List<RecomendacaoProduto> recomendacoes) {

    public record Anotacao(String id, String texto, OrigemAnotacao origem, LocalDate data, String resumo) {}
}
