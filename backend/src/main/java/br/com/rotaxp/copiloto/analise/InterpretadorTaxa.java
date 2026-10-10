package br.com.rotaxp.copiloto.analise;

import br.com.rotaxp.copiloto.config.DesagioProps;
import br.com.rotaxp.copiloto.config.Premissas;
import br.com.rotaxp.copiloto.dominio.Enums.Indexador;
import br.com.rotaxp.copiloto.dominio.SimulacaoDesagio.PremissasMercado;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

@Component
public class InterpretadorTaxa {

    public record TaxaEstimada(double anual, boolean dependeDePremissa, String premissa) {}

    private static final String NUMERO = "(\\d+(?:[.,]\\d+)?)";
    private static final Pattern PERCENTUAL_DO_CDI = Pattern.compile(NUMERO + "\\s*%\\s*do\\s*CDI", Pattern.CASE_INSENSITIVE);
    private static final Pattern INDEXADOR_MAIS_SPREAD =
            Pattern.compile("(IPCA|SELIC|CDI)\\s*\\+\\s*" + NUMERO + "\\s*%", Pattern.CASE_INSENSITIVE);
    private static final Pattern PREFIXADA = Pattern.compile(NUMERO + "\\s*%\\s*a\\.?\\s*a", Pattern.CASE_INSENSITIVE);

    private final double cdi;
    private final double ipca;
    private final double selic;

    public InterpretadorTaxa(Premissas premissas, DesagioProps props) {
        this.cdi = premissas.cdiAnual().doubleValue();
        this.ipca = props.ipcaAnual().doubleValue();
        this.selic = props.selicAnual().doubleValue();
    }

    public PremissasMercado premissas() {
        return new PremissasMercado(cdi, ipca, selic);
    }

    public Optional<TaxaEstimada> interpretar(Indexador indexador, String texto) {
        if (indexador == null || texto == null || texto.isBlank()) return Optional.empty();
        return switch (indexador) {
            case PRE -> percentual(PREFIXADA, texto).map(x -> new TaxaEstimada(x, false, null));
            case CDI -> percentual(PERCENTUAL_DO_CDI, texto)
                    .map(p -> new TaxaEstimada(p * cdi, true, premissa("CDI", cdi)))
                    .or(() -> spread(texto, indexador));
            case IPCA, SELIC -> spread(texto, indexador);
            case NA -> Optional.empty();
        };
    }

    private Optional<TaxaEstimada> spread(String texto, Indexador indexador) {
        Matcher m = INDEXADOR_MAIS_SPREAD.matcher(texto);
        while (m.find()) {
            if (Indexador.valueOf(m.group(1).toUpperCase(Locale.ROOT)) != indexador) continue;
            double s = fracao(m.group(2));
            return Optional.of(switch (indexador) {
                case IPCA -> new TaxaEstimada((1 + ipca) * (1 + s) - 1, true, premissa("IPCA", ipca));
                case SELIC -> new TaxaEstimada(selic + s, true, premissa("Selic", selic));
                default -> new TaxaEstimada(cdi + s, true, premissa("CDI", cdi));
            });
        }
        return Optional.empty();
    }

    private static String premissa(String nome, double taxa) {
        return nome + " de " + Texto.pct(taxa) + " a.a.";
    }

    private static Optional<Double> percentual(Pattern p, String texto) {
        Matcher m = p.matcher(texto);
        return m.find() ? Optional.of(fracao(m.group(1))) : Optional.empty();
    }

    private static double fracao(String numeroPtBr) {
        return Double.parseDouble(numeroPtBr.replace(',', '.')) / 100;
    }
}
