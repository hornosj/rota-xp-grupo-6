package br.com.rotaxp.copiloto.openfinance;

import br.com.rotaxp.copiloto.dominio.Cliente;
import br.com.rotaxp.copiloto.dominio.Consentimento;
import br.com.rotaxp.copiloto.dominio.Conta;
import br.com.rotaxp.copiloto.dominio.Enums.Escopo;
import br.com.rotaxp.copiloto.dominio.Instituicao;
import br.com.rotaxp.copiloto.dominio.Transacao;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Predicate;
import org.springframework.stereotype.Component;

/**
 * Única porta de leitura para a camada analise. Só devolve dados de instituições com consentimento
 * ATIVO e com o escopo certo; o consentimento INTERNO (XP) é sempre ativo e cobre tudo.
 */
@Component
public class OpenFinanceGateway {

    private final Repositorio repo;

    public OpenFinanceGateway(Repositorio repo) {
        this.repo = repo;
    }

    public DadosVisiveis dados(String clienteId) {
        Cliente cliente = repo.cliente(clienteId);
        List<Consentimento> consentimentos = repo.consentimentos(clienteId);

        Predicate<String> contas = inst -> cobre(consentimentos, inst, Escopo.CONTAS);
        Predicate<String> cartoes = inst -> cobre(consentimentos, inst, Escopo.CARTOES);
        Predicate<String> credito = inst -> cobre(consentimentos, inst, Escopo.CREDITO);
        Predicate<String> investimentos = inst -> cobre(consentimentos, inst, Escopo.INVESTIMENTOS);

        List<Conta> contasVisiveis = repo.contas(clienteId).stream().filter(c -> contas.test(c.instituicaoId())).toList();
        List<Transacao> transacoes = contasVisiveis.stream().flatMap(c -> repo.transacoes(c.id()).stream()).toList();

        Map<String, Instituicao> visiveis = new LinkedHashMap<>();
        consentimentos.stream().filter(Consentimento::ativo)
                .forEach(c -> repo.instituicao(c.instituicaoId()).ifPresent(i -> visiveis.put(i.id(), i)));

        return new DadosVisiveis(
                cliente, consentimentos, visiveis, contasVisiveis, transacoes,
                repo.faturas(clienteId).stream().filter(f -> cartoes.test(f.instituicaoId())).toList(),
                repo.creditos(clienteId).stream().filter(c -> credito.test(c.instituicaoId())).toList(),
                repo.investimentos(clienteId).stream().filter(p -> investimentos.test(p.instituicaoId())).toList(),
                repo.instituicoes(), repo.emissores());
    }

    private static boolean cobre(List<Consentimento> consentimentos, String instituicaoId, Escopo escopo) {
        return consentimentos.stream().anyMatch(c -> c.instituicaoId().equals(instituicaoId) && c.cobre(escopo));
    }
}
