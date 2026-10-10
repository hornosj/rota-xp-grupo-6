package br.com.rotaxp.copiloto.config;

import br.com.rotaxp.copiloto.dominio.Enums.TipoNecessidade;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Notas do assessor sobre o cliente ("editar cliente").
 *
 * @param maxNoContexto quantas notas recentes o LLM recebe no contexto do cliente
 * @param maxCaracteres tamanho máximo de uma nota
 * @param catalogo      produto oferecido para cada necessidade (o LLM só classifica; a regra recomenda)
 */
@ConfigurationProperties("anotacoes")
public record AnotacoesProps(int maxNoContexto, int maxCaracteres, Map<TipoNecessidade, Produto> catalogo) {

    public record Produto(String nome, String descricao) {}
}
