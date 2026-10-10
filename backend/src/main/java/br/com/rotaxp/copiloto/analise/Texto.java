package br.com.rotaxp.copiloto.analise;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.Locale;

/** Formatação pt-BR para os textos de alertas, ações e jornada. */
public final class Texto {

    private static final Locale PT_BR = Locale.forLanguageTag("pt-BR");

    private Texto() {}

    /** Forma curta: "R$ 400 mil", "R$ 1,2 milhão", "R$ 850". */
    public static String reais(BigDecimal v) {
        double x = v.doubleValue();
        double abs = Math.abs(x);
        if (abs >= 1_000_000) {
            double mi = x / 1_000_000;
            return "R$ " + decimal(mi) + (Math.abs(mi) < 2 ? " milhão" : " milhões");
        }
        if (abs >= 1_000) return "R$ " + decimal(x / 1_000) + " mil";
        return "R$ " + decimal(x);
    }

    /** "R$ 61.000,00". */
    public static String reaisCompletos(BigDecimal v) {
        return NumberFormat.getCurrencyInstance(PT_BR).format(v).replace(' ', ' ');
    }

    /** Fração 0–1 como "24,5%". */
    public static String pct(double fracao) {
        return decimal(fracao * 100) + "%";
    }

    /** Até uma casa decimal, sem zeros à direita: "6,5", "3". */
    public static String decimal(double x) {
        NumberFormat f = NumberFormat.getNumberInstance(PT_BR);
        f.setMaximumFractionDigits(1);
        f.setMinimumFractionDigits(0);
        return f.format(x);
    }
}
