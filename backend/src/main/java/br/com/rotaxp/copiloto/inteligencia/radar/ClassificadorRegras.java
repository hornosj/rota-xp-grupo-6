package br.com.rotaxp.copiloto.inteligencia.radar;

import br.com.rotaxp.copiloto.dominio.Emissor;
import br.com.rotaxp.copiloto.dominio.Enums.Indexador;
import br.com.rotaxp.copiloto.dominio.Enums.Produto;
import br.com.rotaxp.copiloto.dominio.Radar.Classificacao;
import br.com.rotaxp.copiloto.dominio.Radar.DirecaoNoticia;
import br.com.rotaxp.copiloto.dominio.Radar.Noticia;
import br.com.rotaxp.copiloto.dominio.Radar.OrigemClassificacao;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Classificação determinística por palavras-chave. É o piso do radar (sem LLM) e o plano B
 * quando o LLM falha ou devolve algo inválido.
 */
@Component
public class ClassificadorRegras {

    private static final Map<String, Indexador> INDEXADORES = new LinkedHashMap<>();
    private static final Map<String, Produto> PRODUTOS = new LinkedHashMap<>();
    static {
        INDEXADORES.put("\\bSELIC\\b", Indexador.SELIC);
        INDEXADORES.put("\\bCDI\\b", Indexador.CDI);
        INDEXADORES.put("\\bIPCA\\b|\\bINFLACAO\\b", Indexador.IPCA);
        INDEXADORES.put("PREFIXAD|JUROS FUTUROS", Indexador.PRE);
        PRODUTOS.put("\\bCDBS?\\b", Produto.CDB);
        PRODUTOS.put("\\bLCAS?\\b", Produto.LCA);
        PRODUTOS.put("\\bLCIS?\\b", Produto.LCI);
        PRODUTOS.put("\\bCRAS?\\b", Produto.CRA);
        PRODUTOS.put("\\bCRIS?\\b", Produto.CRI);
        PRODUTOS.put("DEBENTURE", Produto.DEBENTURE);
        PRODUTOS.put("POUPANCA", Produto.POUPANCA);
        PRODUTOS.put("\\bTESOURO\\b|TITULOS PUBLICOS", Produto.TESOURO);
        PRODUTOS.put("\\bFUNDOS?\\b|MULTIMERCADO", Produto.FUNDO);
        PRODUTOS.put("\\bACOES\\b|\\bBOLSA\\b", Produto.ACAO);
    }
    private static final List<String> NEGATIVAS = List.of("REBAIX", "PREJUIZO", "ADIA", "QUEBRA", "BOATO", "REESTRUTURA",
            "QUEDA", "PRESSIONA", "RESGATES LIQUIDOS", "INCERTEZA", "CALOTE", "INADIMPL", "RECUPERACAO JUDICIAL");
    private static final List<String> POSITIVAS = List.of("MAXIMA", "AUMENTO DE CAPITAL", "RECORDE", "LANCA", "AQUECID",
            "ELEVA O RATING", "MELHORA");

    public Classificacao classificar(Noticia n, Map<String, Emissor> emissores) {
        String texto = normalizar(n.titulo() + " " + (n.resumo() == null ? "" : n.resumo()));

        List<String> achados = emissores(texto, emissores);
        List<Indexador> indexadores = buscar(texto, INDEXADORES);
        List<Produto> produtos = buscar(texto, PRODUTOS);
        DirecaoNoticia direcao = NEGATIVAS.stream().anyMatch(texto::contains) ? DirecaoNoticia.NEGATIVA
                : POSITIVAS.stream().anyMatch(texto::contains) ? DirecaoNoticia.POSITIVA : DirecaoNoticia.NEUTRA;

        double relevancia = 0.1;
        if (!achados.isEmpty()) relevancia += 0.4;
        if (!indexadores.isEmpty() || !produtos.isEmpty()) relevancia += 0.2;
        if (direcao == DirecaoNoticia.NEGATIVA) relevancia += 0.2;
        return new Classificacao(achados, indexadores, produtos, direcao, Math.min(0.9, round(relevancia)), null,
                OrigemClassificacao.REGRAS);
    }

    /** Casa nomes e apelidos dos emissores; os mais longos primeiro, apagando o trecho casado. */
    private static List<String> emissores(String texto, Map<String, Emissor> emissores) {
        List<String[]> apelidos = new ArrayList<>();   // {apelido, emissorId}
        for (Emissor e : emissores.values()) {
            for (String a : apelidos(e)) apelidos.add(new String[] {a, e.id()});
        }
        apelidos.sort(Comparator.comparingInt((String[] a) -> a[0].length()).reversed());

        Set<String> achados = new LinkedHashSet<>();
        String restante = " " + texto + " ";
        for (String[] a : apelidos) {
            Matcher m = Pattern.compile("\\b" + Pattern.quote(a[0]) + "\\b").matcher(restante);
            if (m.find()) {
                achados.add(a[1]);
                restante = m.replaceAll(" ");
            }
        }
        return emissores.keySet().stream().filter(achados::contains).toList();
    }

    private static Set<String> apelidos(Emissor e) {
        String nome = normalizar(e.nome()).replace(" S.A.", "").replace(" S/A", "").strip();
        Set<String> r = new LinkedHashSet<>();
        r.add(nome);
        if (nome.startsWith("BANCO ")) r.add(nome.substring("BANCO ".length()));
        String[] palavras = nome.split("\\s+");
        if (palavras.length >= 3) r.add(palavras[0] + " " + palavras[1]);
        r.removeIf(a -> a.length() < 3 || a.equals("XP") || a.equals("TESOURO"));
        return r;
    }

    private static <T> List<T> buscar(String texto, Map<String, T> regras) {
        Set<T> r = new LinkedHashSet<>();
        regras.forEach((regex, valor) -> {
            if (Pattern.compile(regex).matcher(texto).find()) r.add(valor);
        });
        return List.copyOf(r);
    }

    static String normalizar(String s) {
        return Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toUpperCase();
    }

    private static double round(double v) {
        return Math.round(v * 100) / 100.0;
    }
}
