package br.com.rotaxp.copiloto.analise;

import java.time.LocalDate;
import java.time.YearMonth;

/** Janela dos últimos N meses completos antes do mês da data de referência. */
public record Janela(YearMonth inicio, YearMonth fim, int meses) {

    public static Janela ultimosMeses(LocalDate ref, int meses) {
        YearMonth atual = YearMonth.from(ref);
        return new Janela(atual.minusMonths(meses), atual.minusMonths(1), meses);
    }

    public boolean contem(LocalDate data) {
        return contem(YearMonth.from(data));
    }

    public boolean contem(YearMonth mes) {
        return !mes.isBefore(inicio) && !mes.isAfter(fim);
    }

    public boolean contem(String mesReferencia) {
        return contem(YearMonth.parse(mesReferencia));
    }
}
