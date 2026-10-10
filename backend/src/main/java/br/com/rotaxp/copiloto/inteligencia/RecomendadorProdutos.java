package br.com.rotaxp.copiloto.inteligencia;

import br.com.rotaxp.copiloto.config.AnotacoesProps;
import br.com.rotaxp.copiloto.dominio.Enums.TipoNecessidade;
import br.com.rotaxp.copiloto.dominio.Necessidade;
import br.com.rotaxp.copiloto.dominio.RecomendacaoProduto;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

/** Necessidade → produto do catálogo, por regra. Fora do catálogo ou repetida: ignorada. */
@Component
public class RecomendadorProdutos {

    private final AnotacoesProps props;

    public RecomendadorProdutos(AnotacoesProps props) {
        this.props = props;
    }

    public List<RecomendacaoProduto> recomendar(List<Necessidade> necessidades) {
        List<RecomendacaoProduto> r = new ArrayList<>();
        Set<TipoNecessidade> vistas = EnumSet.noneOf(TipoNecessidade.class);
        for (Necessidade n : necessidades == null ? List.<Necessidade>of() : necessidades) {
            AnotacoesProps.Produto p = props.catalogo() == null ? null : props.catalogo().get(n.tipo());
            if (p == null || !vistas.add(n.tipo())) continue;
            r.add(new RecomendacaoProduto(n.tipo(), p.nome(), p.descricao(), n.motivo()));
        }
        return r;
    }
}
