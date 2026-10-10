package br.com.rotaxp.copiloto.openfinance;

import br.com.rotaxp.copiloto.dominio.Cliente;
import br.com.rotaxp.copiloto.dominio.Consentimento;
import br.com.rotaxp.copiloto.dominio.Conta;
import br.com.rotaxp.copiloto.dominio.Emissor;
import br.com.rotaxp.copiloto.dominio.Enums.Escopo;
import br.com.rotaxp.copiloto.dominio.FaturaCartao;
import br.com.rotaxp.copiloto.dominio.Instituicao;
import br.com.rotaxp.copiloto.dominio.OperacaoCredito;
import br.com.rotaxp.copiloto.dominio.PosicaoInvestimento;
import br.com.rotaxp.copiloto.dominio.Transacao;
import java.util.List;
import java.util.Map;

/**
 * O que a XP enxerga de um cliente: só dados de instituições com consentimento ATIVO e com o escopo
 * correspondente. É o único insumo da camada analise.
 */
public record DadosVisiveis(
        Cliente cliente,
        List<Consentimento> consentimentos,
        Map<String, Instituicao> instituicoesVisiveis,
        List<Conta> contas, List<Transacao> transacoes, List<FaturaCartao> faturas,
        List<OperacaoCredito> creditos, List<PosicaoInvestimento> investimentos,
        Map<String, Instituicao> todasInstituicoes, Map<String, Emissor> emissores) {

    public Instituicao instituicao(String id) { return todasInstituicoes.get(id); }

    public Emissor emissor(String id) { return id == null ? null : emissores.get(id); }

    public boolean visivel(String instituicaoId, Escopo escopo) {
        return consentimentos.stream().anyMatch(c -> c.instituicaoId().equals(instituicaoId) && c.cobre(escopo));
    }

    public boolean conectada(String instituicaoId) {
        return consentimentos.stream().anyMatch(c -> c.instituicaoId().equals(instituicaoId) && c.ativo());
    }

    public Conta conta(String contaId) {
        return contas.stream().filter(c -> c.id().equals(contaId)).findFirst().orElse(null);
    }
}
