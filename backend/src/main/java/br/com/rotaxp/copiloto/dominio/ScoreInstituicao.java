package br.com.rotaxp.copiloto.dominio;

import java.util.List;

public record ScoreInstituicao(
        String instituicaoId, String nome, boolean ehXp, double score,
        Componentes participacoes, Componentes contribuicoes, List<String> destaques) {

    public record Componentes(double renda, double movimentacao, double contasRecorrentes,
                              double investimentos, double cartao, double credito) {}
}
