package br.com.rotaxp.copiloto.analise;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Convenções de dinheiro: BigDecimal escala 2, HALF_EVEN. */
public final class Dinheiro {

    public static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2);

    private Dinheiro() {}

    public static BigDecimal de(BigDecimal v) {
        return v == null ? ZERO : v.setScale(2, RoundingMode.HALF_EVEN);
    }

    /** parte / total como fração 0–1; zero se o total for zero. */
    public static double fracao(BigDecimal parte, BigDecimal total) {
        if (total == null || total.signum() == 0) return 0;
        return parte.divide(total, 6, RoundingMode.HALF_EVEN).doubleValue();
    }
}
