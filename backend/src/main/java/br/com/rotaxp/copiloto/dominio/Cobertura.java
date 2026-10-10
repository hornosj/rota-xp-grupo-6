package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.ProdutoDeclarado;
import java.util.List;

public record Cobertura(int instituicoesDeclaradas, int instituicoesConectadas, double percentual, List<Pendente> pendentes) {
    public record Pendente(String instituicaoId, String nome, List<ProdutoDeclarado> produtos) {}
}
