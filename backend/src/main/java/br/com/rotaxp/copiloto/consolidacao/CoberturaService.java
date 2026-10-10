package br.com.rotaxp.copiloto.consolidacao;

import br.com.rotaxp.copiloto.dominio.Cliente.InstituicaoDeclarada;
import br.com.rotaxp.copiloto.dominio.Cobertura;
import br.com.rotaxp.copiloto.dominio.Cobertura.Pendente;
import br.com.rotaxp.copiloto.dominio.Instituicao;
import br.com.rotaxp.copiloto.openfinance.DadosVisiveis;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

/** Cobertura = instituições declaradas pelo cliente que estão conectadas (a XP conta como conectada). */
@Service
public class CoberturaService {

    public Cobertura calcular(DadosVisiveis d) {
        List<InstituicaoDeclarada> declaradas = d.cliente().instituicoesDeclaradas() == null
                ? List.of() : d.cliente().instituicoesDeclaradas();
        int conectadas = 0;
        List<Pendente> pendentes = new ArrayList<>();
        for (InstituicaoDeclarada decl : declaradas) {
            if (d.conectada(decl.instituicaoId())) {
                conectadas++;
            } else {
                Instituicao inst = d.instituicao(decl.instituicaoId());
                pendentes.add(new Pendente(decl.instituicaoId(), inst == null ? decl.instituicaoId() : inst.nome(), decl.produtos()));
            }
        }
        double pct = declaradas.isEmpty() ? 1.0
                : BigDecimal.valueOf(conectadas).divide(BigDecimal.valueOf(declaradas.size()), 3, RoundingMode.HALF_EVEN).doubleValue();
        return new Cobertura(declaradas.size(), conectadas, pct, List.copyOf(pendentes));
    }
}
