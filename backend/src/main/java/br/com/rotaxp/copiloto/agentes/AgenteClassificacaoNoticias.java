package br.com.rotaxp.copiloto.agentes;

import br.com.rotaxp.copiloto.agentes.AgentesTipos.LoteClassificado;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.LoteNoticias;
import br.com.rotaxp.copiloto.dominio.Enums.Indexador;
import br.com.rotaxp.copiloto.dominio.Enums.Produto;
import br.com.rotaxp.copiloto.dominio.Radar.DirecaoNoticia;
import br.com.rotaxp.copiloto.dominio.Radar.Noticia;
import com.embabel.agent.api.annotation.AchievesGoal;
import com.embabel.agent.api.annotation.Action;
import com.embabel.agent.api.annotation.Agent;
import com.embabel.agent.api.common.OperationContext;
import java.util.Arrays;
import java.util.stream.Collectors;

/**
 * Radar (BE2-10): classifica um lote de notícias numa única chamada — o system prompt (regras e listas
 * permitidas) é pago uma vez por lote, não por notícia. O modelo vem no lote (barato, configurável).
 */
@Agent(description = "Classifica notícias por emissores, indexadores, produtos, direção e relevância")
public class AgenteClassificacaoNoticias {

    @AchievesGoal(description = "Lote de notícias classificado")
    @Action(description = "Classifica o lote com o LLM")
    public LoteClassificado classificar(LoteNoticias lote, OperationContext ctx) {
        return ctx.ai().withLlm(lote.modelo())
                .withSystemPrompt(system(lote))
                .createObject(usuario(lote), LoteClassificado.class);
    }

    static String system(LoteNoticias lote) {
        String emissores = lote.emissoresPermitidos().stream()
                .map(e -> "- " + e.id() + ": " + e.nome()).collect(Collectors.joining("\n"));
        return """
                Você classifica notícias do mercado financeiro brasileiro para um radar de carteiras.
                Para cada notícia, devolva um item com o mesmo "noticiaId" e:
                - "emissores": ids da lista abaixo citados ou diretamente afetados (nunca invente ids):
                %s
                - "indexadores": valores entre %s afetados pela notícia.
                - "produtos": valores entre %s afetados pela notícia.
                - "direcao": um de %s, do ponto de vista de quem investe nesses ativos.
                - "relevancia": de 0 a 1 (1 = muda o rumo de uma carteira exposta; 0 = irrelevante para investimentos).
                - "resumoImpacto": uma frase curta em pt-BR sobre o impacto para o investidor.
                Classifique só com base no texto; deixe listas vazias quando não houver nada.
                """.formatted(emissores, nomes(Indexador.values()), nomes(Produto.values()), nomes(DirecaoNoticia.values()));
    }

    static String usuario(LoteNoticias lote) {
        StringBuilder sb = new StringBuilder("Notícias:\n");
        for (Noticia n : lote.noticias()) {
            sb.append("\n[").append(n.id()).append("] ").append(n.titulo());
            if (n.resumo() != null && !n.resumo().isBlank()) sb.append("\n").append(n.resumo());
            sb.append("\n");
        }
        return sb.toString();
    }

    private static String nomes(Enum<?>[] valores) {
        return Arrays.stream(valores).map(Enum::name).filter(v -> !v.equals("NA")).collect(Collectors.joining(", "));
    }
}
