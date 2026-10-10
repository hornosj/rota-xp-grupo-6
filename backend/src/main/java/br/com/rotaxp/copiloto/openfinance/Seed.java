package br.com.rotaxp.copiloto.openfinance;

import br.com.rotaxp.copiloto.dominio.Cliente;
import br.com.rotaxp.copiloto.dominio.Consentimento;
import br.com.rotaxp.copiloto.dominio.Conta;
import br.com.rotaxp.copiloto.dominio.Emissor;
import br.com.rotaxp.copiloto.dominio.FaturaCartao;
import br.com.rotaxp.copiloto.dominio.Instituicao;
import br.com.rotaxp.copiloto.dominio.OperacaoCredito;
import br.com.rotaxp.copiloto.dominio.PosicaoInvestimento;
import br.com.rotaxp.copiloto.dominio.Transacao;
import java.util.List;

public record Seed(
        List<Instituicao> instituicoes, List<Emissor> emissores, List<Cliente> clientes,
        List<Consentimento> consentimentos, List<Conta> contas, List<Transacao> transacoes,
        List<FaturaCartao> faturas, List<OperacaoCredito> creditos, List<PosicaoInvestimento> investimentos) {}
