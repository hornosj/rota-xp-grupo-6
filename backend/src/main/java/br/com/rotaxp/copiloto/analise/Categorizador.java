package br.com.rotaxp.copiloto.analise;

import br.com.rotaxp.copiloto.dominio.Enums.Modalidade;
import br.com.rotaxp.copiloto.dominio.Enums.TipoTransacao;
import br.com.rotaxp.copiloto.dominio.Instituicao;
import br.com.rotaxp.copiloto.dominio.Transacao;
import java.text.Normalizer;
import java.util.Arrays;
import java.util.Collection;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

/** Regras de categorização do PLAN §7.1, aplicadas em ordem. */
@Component
public class Categorizador {

    private static final Set<String> CONTAS_RECORRENTES = Set.of(
            "CONDOMINIO", "ALUGUEL", "ENERGIA", "AGUA", "INTERNET", "TELEFONE", "PLANO DE SAUDE", "ESCOLA", "ACADEMIA");
    private static final String FATURA = "FATURA CARTAO";

    public Categoria categorizar(Transacao t, String cpfCliente) {
        String desc = normalizar(t.descricao());
        if (cpfCliente != null && cpfCliente.equals(t.contraparteDocumento())) return Categoria.TRANSFERENCIA_PROPRIA;
        if (desc.startsWith("APLICACAO")) return Categoria.APLICACAO;
        if (desc.startsWith("RESGATE")) return Categoria.RESGATE;
        if (desc.contains(FATURA)) return Categoria.PAGAMENTO_FATURA;
        if (desc.contains("PARCELA")) return Categoria.PARCELA_CREDITO;
        if (t.tipo() == TipoTransacao.DEBITO
                && (t.modalidade() == Modalidade.BOLETO || t.modalidade() == Modalidade.DEBITO_AUTOMATICO
                    || CONTAS_RECORRENTES.contains(desc))) {
            return Categoria.CONTA_RECORRENTE;
        }
        return t.tipo() == TipoTransacao.CREDITO ? Categoria.CREDITO_CANDIDATO_RENDA : Categoria.CONSUMO;
    }

    /** Instituição do cartão em "FATURA CARTAO &lt;BANCO&gt;": casa com a última palavra do nome. */
    public String bancoDaFatura(String descricao, Collection<Instituicao> instituicoes) {
        String desc = normalizar(descricao);
        int i = desc.indexOf(FATURA);
        if (i < 0) return null;
        String banco = desc.substring(i + FATURA.length()).trim();
        if (banco.isEmpty()) return null;
        for (Instituicao inst : instituicoes) {
            String[] palavras = normalizar(inst.nome()).split("\\s+");
            if (palavras[palavras.length - 1].equals(banco) || (inst.ehXp() && banco.equals("XP"))) return inst.id();
        }
        return instituicoes.stream()
                .filter(inst -> Arrays.asList(normalizar(inst.nome()).split("\\s+")).contains(banco))
                .map(Instituicao::id).findFirst().orElse(null);
    }

    public String bancoDaFatura(String descricao, Map<String, Instituicao> instituicoes) {
        return bancoDaFatura(descricao, instituicoes.values());
    }

    static String normalizar(String s) {
        if (s == null) return "";
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toUpperCase().trim();
    }
}
