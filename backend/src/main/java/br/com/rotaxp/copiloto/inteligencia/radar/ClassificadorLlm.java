package br.com.rotaxp.copiloto.inteligencia.radar;

import br.com.rotaxp.copiloto.agentes.AgentesTipos.ItemClassificado;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.LoteClassificado;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.LoteNoticias;
import br.com.rotaxp.copiloto.agentes.ExecutorAgentes;
import br.com.rotaxp.copiloto.dominio.Emissor;
import br.com.rotaxp.copiloto.dominio.Enums.Indexador;
import br.com.rotaxp.copiloto.dominio.Enums.Produto;
import br.com.rotaxp.copiloto.dominio.Radar.Classificacao;
import br.com.rotaxp.copiloto.dominio.Radar.DirecaoNoticia;
import br.com.rotaxp.copiloto.dominio.Radar.Noticia;
import br.com.rotaxp.copiloto.dominio.Radar.OrigemClassificacao;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Classificação por LLM em lotes. Cada item da resposta é validado; o que faltar ou falhar cai no
 * ClassificadorRegras. Não é bean: o RadarConfig monta com o modelo e o tamanho de lote configurados.
 */
public class ClassificadorLlm {

    private static final Logger log = LoggerFactory.getLogger(ClassificadorLlm.class);

    public record Resultado(Map<String, Classificacao> classificacoes, int porLlm, int porRegra, int lotes) {}

    private final ExecutorAgentes agentes;
    private final ClassificadorRegras regras;
    private final String modelo;
    private final int tamanhoLote;
    private final int maxTokens;

    /** Teto de tokens de saída padrão: ~150 por notícia do lote. */
    public ClassificadorLlm(ExecutorAgentes agentes, ClassificadorRegras regras, String modelo, int tamanhoLote) {
        this(agentes, regras, modelo, tamanhoLote, Math.max(1, tamanhoLote) * 150);
    }

    public ClassificadorLlm(ExecutorAgentes agentes, ClassificadorRegras regras, String modelo, int tamanhoLote, int maxTokens) {
        this.agentes = agentes;
        this.regras = regras;
        this.modelo = modelo;
        this.tamanhoLote = Math.max(1, tamanhoLote);
        this.maxTokens = maxTokens;
    }

    public Resultado classificar(List<Noticia> noticias, Map<String, Emissor> emissores) {
        List<LoteNoticias.EmissorPermitido> permitidos = emissores.values().stream()
                .map(e -> new LoteNoticias.EmissorPermitido(e.id(), e.nome())).toList();
        Map<String, Classificacao> r = new LinkedHashMap<>();
        int porLlm = 0, lotes = 0;
        for (int i = 0; i < noticias.size(); i += tamanhoLote) {
            List<Noticia> lote = noticias.subList(i, Math.min(noticias.size(), i + tamanhoLote));
            lotes++;
            Map<String, ItemClassificado> itens = Map.of();
            try {
                LoteClassificado resp = agentes.executar(new LoteNoticias(List.copyOf(lote), modelo, maxTokens, permitidos), LoteClassificado.class);
                if (resp != null && resp.itens() != null) {
                    itens = new LinkedHashMap<>();
                    for (ItemClassificado it : resp.itens()) if (it != null && it.noticiaId() != null) itens.put(it.noticiaId(), it);
                }
            } catch (Exception e) {   // inclui a ExecutionException não declarada do Embabel
                log.warn("Lote {} falhou no LLM ({}): usando regras", lotes, e.getMessage());
            }
            for (Noticia n : lote) {
                ItemClassificado it = itens.get(n.id());
                if (it != null) {
                    r.put(n.id(), validar(it, emissores));
                    porLlm++;
                } else {
                    r.put(n.id(), regras.classificar(n, emissores));
                }
            }
        }
        return new Resultado(r, porLlm, noticias.size() - porLlm, lotes);
    }

    private static Classificacao validar(ItemClassificado it, Map<String, Emissor> emissores) {
        List<String> em = lista(it.emissores()).stream().filter(emissores::containsKey).distinct().toList();
        List<Indexador> ix = enums(it.indexadores(), Indexador::valueOf);
        List<Produto> pr = enums(it.produtos(), Produto::valueOf);
        DirecaoNoticia dir;
        try {
            dir = DirecaoNoticia.valueOf(it.direcao() == null ? "" : it.direcao().strip().toUpperCase());
        } catch (IllegalArgumentException e) {
            dir = DirecaoNoticia.NEUTRA;
        }
        double rel = Math.max(0.0, Math.min(1.0, it.relevancia()));
        return new Classificacao(em, ix, pr, dir, rel, it.resumoImpacto(), OrigemClassificacao.LLM);
    }

    private static <E extends Enum<E>> List<E> enums(List<String> valores, Function<String, E> conv) {
        LinkedHashSet<E> r = new LinkedHashSet<>();
        for (String v : lista(valores)) {
            try {
                E e = conv.apply(v.strip().toUpperCase());
                if (!e.name().equals("NA")) r.add(e);
            } catch (IllegalArgumentException ignorado) { /* valor fora do enum */ }
        }
        return List.copyOf(r);
    }

    private static List<String> lista(List<String> l) {
        return l == null ? List.of() : new ArrayList<>(l.stream().filter(java.util.Objects::nonNull).toList());
    }
}
