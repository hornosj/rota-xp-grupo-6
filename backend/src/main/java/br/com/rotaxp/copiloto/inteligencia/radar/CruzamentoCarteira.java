package br.com.rotaxp.copiloto.inteligencia.radar;

import br.com.rotaxp.copiloto.analise.Texto;
import br.com.rotaxp.copiloto.dominio.Conta;
import br.com.rotaxp.copiloto.dominio.Emissor;
import br.com.rotaxp.copiloto.dominio.Enums.Produto;
import br.com.rotaxp.copiloto.dominio.PosicaoInvestimento;
import br.com.rotaxp.copiloto.dominio.Radar.Classificacao;
import br.com.rotaxp.copiloto.dominio.Radar.ImpactoNoticia;
import br.com.rotaxp.copiloto.dominio.Radar.NoticiaClassificada;
import br.com.rotaxp.copiloto.openfinance.DadosVisiveis;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Cruza notícias classificadas com a carteira visível do cliente — por regra, sem LLM.
 * Notícia com emissores casa só pela exposição a esses emissores (pelo conglomerado);
 * notícia macro (sem emissor) casa por indexador ou produto.
 * pontos = relevância × 100 × min(1, fração do patrimônio / fração plena).
 */
public class CruzamentoCarteira {

    private final double fracaoPlena;
    private final double pontosMinimos;

    public CruzamentoCarteira(double fracaoPlena, double pontosMinimos) {
        this.fracaoPlena = fracaoPlena;
        this.pontosMinimos = pontosMinimos;
    }

    public List<ImpactoNoticia> impactos(DadosVisiveis d, List<NoticiaClassificada> noticias) {
        BigDecimal patrimonio = d.investimentos().stream().map(PosicaoInvestimento::valorAtual).reduce(BigDecimal.ZERO, BigDecimal::add)
                .add(d.contas().stream().map(Conta::saldo).reduce(BigDecimal.ZERO, BigDecimal::add));
        List<ImpactoNoticia> r = new ArrayList<>();
        if (patrimonio.signum() == 0) return r;

        for (NoticiaClassificada nc : noticias) {
            Classificacao c = nc.classificacao();
            Set<String> gatilhos = new LinkedHashSet<>();
            List<PosicaoInvestimento> expostas = new ArrayList<>();
            if (!c.emissores().isEmpty()) {
                Set<String> conglomerados = new LinkedHashSet<>();
                c.emissores().stream().map(d::emissor).filter(java.util.Objects::nonNull).forEach(e -> conglomerados.add(e.conglomeradoId()));
                for (PosicaoInvestimento p : d.investimentos()) {
                    Emissor e = d.emissor(p.emissorId());
                    if (e != null && conglomerados.contains(e.conglomeradoId())) {
                        expostas.add(p);
                        gatilhos.add("emissor: " + e.nome());
                    }
                }
            } else {
                for (PosicaoInvestimento p : d.investimentos()) {
                    boolean porIndexador = p.indexador() != null && c.indexadores().contains(p.indexador());
                    boolean porProduto = c.produtos().contains(p.produto());
                    if (porIndexador || porProduto) {
                        expostas.add(p);
                        gatilhos.add(porIndexador ? "indexador: " + p.indexador() : "produto: " + p.produto());
                    }
                }
            }
            if (expostas.isEmpty()) continue;

            BigDecimal exposto = expostas.stream().map(PosicaoInvestimento::valorAtual).reduce(BigDecimal.ZERO, BigDecimal::add);
            double fracao = exposto.divide(patrimonio, 4, RoundingMode.HALF_EVEN).doubleValue();
            double pontos = Math.round(c.relevancia() * 100 * Math.min(1.0, fracao / fracaoPlena) * 10) / 10.0;
            if (pontos < pontosMinimos) continue;

            String motivo = Texto.reais(exposto) + " em " + descricao(d, c, expostas) + " (" + Texto.pct(fracao) + " do patrimônio visível)";
            r.add(new ImpactoNoticia(d.cliente().id(), d.cliente().nome(), nc.noticia().id(), nc.noticia().titulo(),
                    nc.noticia().fonte(), c.direcao(), pontos, exposto.setScale(2, RoundingMode.HALF_EVEN), fracao, motivo,
                    List.copyOf(gatilhos)));
        }
        r.sort(Comparator.comparingDouble(ImpactoNoticia::pontos).reversed());
        return r;
    }

    /** "CRA da Agro Sul Sementes S.A." / "CDB e LCA do Banco Horizonte" / "posições ligadas a Tesouro Direto". */
    private static String descricao(DadosVisiveis d, Classificacao c, List<PosicaoInvestimento> expostas) {
        if (c.emissores().isEmpty()) {
            Set<String> itens = new LinkedHashSet<>();
            for (PosicaoInvestimento p : expostas) {
                itens.add(p.indexador() != null && c.indexadores().contains(p.indexador()) ? p.indexador().name() : nomeProduto(p.produto()));
            }
            return "posições ligadas a " + juntar(List.copyOf(itens));
        }
        Map<String, BigDecimal> porEmissor = new LinkedHashMap<>();
        expostas.forEach(p -> porEmissor.merge(p.emissorId(), p.valorAtual(), BigDecimal::add));
        String principal = porEmissor.entrySet().stream().max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElseThrow();
        Emissor e = d.emissor(principal);
        List<String> produtos = expostas.stream().filter(p -> principal.equals(p.emissorId())).map(p -> nomeProduto(p.produto()))
                .distinct().toList();
        String artigo = e.nome().startsWith("Banco") || e.nome().startsWith("Tesouro") ? "do" : "da";
        return juntar(produtos) + " " + artigo + " " + e.nome();
    }

    private static String nomeProduto(Produto p) {
        return switch (p) {
            case TESOURO -> "Tesouro Direto";
            case ACAO -> "ações";
            case FUNDO -> "fundos";
            case POUPANCA -> "poupança";
            case DEBENTURE -> "debêntures";
            case PREVIDENCIA -> "previdência";
            default -> p.name();
        };
    }

    private static String juntar(List<String> itens) {
        if (itens.size() <= 1) return String.join("", itens);
        return String.join(", ", itens.subList(0, itens.size() - 1)) + " e " + itens.get(itens.size() - 1);
    }
}
