package br.com.rotaxp.copiloto.inteligencia.radar;

import br.com.rotaxp.copiloto.dominio.Radar.Classificacao;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Function;

/** Compara classificações com o gabarito curado (micro-média): base para escolher modelos. */
public final class AvaliacaoClassificacao {

    private AvaliacaoClassificacao() {}

    public record Placar(int itens, double precisaoEmissores, double coberturaEmissores,
                         double precisaoIndexadores, double coberturaIndexadores,
                         double precisaoProdutos, double coberturaProdutos,
                         double acertoDirecao, double erroMedioRelevancia) {}

    private record Contagem(int vp, int fp, int fn) {
        double precisao() { return vp + fp == 0 ? 1.0 : (double) vp / (vp + fp); }
        double cobertura() { return vp + fn == 0 ? 1.0 : (double) vp / (vp + fn); }
    }

    public static Placar avaliar(List<Classificacao> gabarito, List<Classificacao> obtidas) {
        if (gabarito.size() != obtidas.size()) throw new IllegalArgumentException("listas de tamanhos diferentes");
        Contagem em = contar(gabarito, obtidas, Classificacao::emissores);
        Contagem ix = contar(gabarito, obtidas, Classificacao::indexadores);
        Contagem pr = contar(gabarito, obtidas, Classificacao::produtos);
        int direcao = 0;
        double erro = 0;
        for (int i = 0; i < gabarito.size(); i++) {
            if (gabarito.get(i).direcao() == obtidas.get(i).direcao()) direcao++;
            erro += Math.abs(gabarito.get(i).relevancia() - obtidas.get(i).relevancia());
        }
        int n = Math.max(1, gabarito.size());
        return new Placar(gabarito.size(), em.precisao(), em.cobertura(), ix.precisao(), ix.cobertura(),
                pr.precisao(), pr.cobertura(), (double) direcao / n, erro / n);
    }

    private static Contagem contar(List<Classificacao> gabarito, List<Classificacao> obtidas,
                                   Function<Classificacao, List<?>> campo) {
        int vp = 0, fp = 0, fn = 0;
        for (int i = 0; i < gabarito.size(); i++) {
            Set<Object> esperado = new HashSet<>(campo.apply(gabarito.get(i)));
            Set<Object> obtido = new HashSet<>(campo.apply(obtidas.get(i)));
            for (Object o : obtido) if (esperado.contains(o)) vp++; else fp++;
            for (Object e : esperado) if (!obtido.contains(e)) fn++;
        }
        return new Contagem(vp, fp, fn);
    }
}
