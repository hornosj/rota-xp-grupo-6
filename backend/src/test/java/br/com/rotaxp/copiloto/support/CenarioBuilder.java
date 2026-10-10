package br.com.rotaxp.copiloto.support;

import br.com.rotaxp.copiloto.dominio.Cliente;
import br.com.rotaxp.copiloto.dominio.Cliente.Dependente;
import br.com.rotaxp.copiloto.dominio.Cliente.InstituicaoDeclarada;
import br.com.rotaxp.copiloto.dominio.Consentimento;
import br.com.rotaxp.copiloto.dominio.Conta;
import br.com.rotaxp.copiloto.dominio.Emissor;
import br.com.rotaxp.copiloto.dominio.Enums.Escopo;
import br.com.rotaxp.copiloto.dominio.Enums.Indexador;
import br.com.rotaxp.copiloto.dominio.Enums.Modalidade;
import br.com.rotaxp.copiloto.dominio.Enums.PerfilInvestidor;
import br.com.rotaxp.copiloto.dominio.Enums.Produto;
import br.com.rotaxp.copiloto.dominio.Enums.ProdutoDeclarado;
import br.com.rotaxp.copiloto.dominio.Enums.StatusConsentimento;
import br.com.rotaxp.copiloto.dominio.Enums.TipoConsentimento;
import br.com.rotaxp.copiloto.dominio.Enums.TipoConta;
import br.com.rotaxp.copiloto.dominio.Enums.TipoCredito;
import br.com.rotaxp.copiloto.dominio.Enums.TipoEmissor;
import br.com.rotaxp.copiloto.dominio.Enums.TipoTransacao;
import br.com.rotaxp.copiloto.dominio.EventoVida;
import br.com.rotaxp.copiloto.dominio.FaturaCartao;
import br.com.rotaxp.copiloto.dominio.Instituicao;
import br.com.rotaxp.copiloto.dominio.OperacaoCredito;
import br.com.rotaxp.copiloto.dominio.PosicaoInvestimento;
import br.com.rotaxp.copiloto.dominio.Transacao;
import br.com.rotaxp.copiloto.openfinance.Seed;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** Monta seeds em memória para os testes, sem depender dos JSON gerados. */
public class CenarioBuilder {

    public static final LocalDate REF = LocalDate.of(2026, 10, 11);

    private final List<Instituicao> instituicoes = new ArrayList<>();
    private final List<Emissor> emissores = new ArrayList<>();
    private final List<Cliente> clientes = new ArrayList<>();
    private final List<Consentimento> consentimentos = new ArrayList<>();
    private final List<Conta> contas = new ArrayList<>();
    private final List<Transacao> transacoes = new ArrayList<>();
    private final List<FaturaCartao> faturas = new ArrayList<>();
    private final List<OperacaoCredito> creditos = new ArrayList<>();
    private final List<PosicaoInvestimento> investimentos = new ArrayList<>();
    private int seq = 0;

    public static CenarioBuilder comInstituicoesPadrao() {
        CenarioBuilder b = new CenarioBuilder();
        b.instituicoes.addAll(List.of(
                new Instituicao("inst-xp", "XP Investimentos", "cong-xp", "XP", true),
                new Instituicao("inst-aurora", "Banco Aurora", "cong-aurora", "Aurora", false),
                new Instituicao("inst-aurora-fin", "Aurora Financeira", "cong-aurora", "Aurora", false),
                new Instituicao("inst-horizonte", "Banco Horizonte", "cong-horizonte", "Horizonte", false),
                new Instituicao("inst-ipe", "Banco Ipê", "cong-ipe", "Ipê", false)));
        b.emissores.addAll(List.of(
                new Emissor("emi-xp", "XP Investimentos", "cong-xp", TipoEmissor.BANCO),
                new Emissor("emi-aurora", "Banco Aurora", "cong-aurora", TipoEmissor.BANCO),
                new Emissor("emi-aurora-fin", "Aurora Financeira", "cong-aurora", TipoEmissor.BANCO),
                new Emissor("emi-horizonte", "Banco Horizonte", "cong-horizonte", TipoEmissor.BANCO),
                new Emissor("emi-ipe", "Banco Ipê", "cong-ipe", TipoEmissor.BANCO),
                new Emissor("emi-tesouro", "Tesouro Nacional", "cong-tesouro", TipoEmissor.TESOURO),
                new Emissor("emi-agrosul", "Agro Sul Sementes S.A.", "cong-agrosul", TipoEmissor.EMPRESA)));
        return b;
    }

    public static BigDecimal r(double v) { return BigDecimal.valueOf(v).setScale(2); }

    public static InstituicaoDeclarada decl(String inst, ProdutoDeclarado... p) {
        return new InstituicaoDeclarada(inst, Arrays.asList(p));
    }

    public CenarioBuilder cliente(String id, String nome, String cpf, PerfilInvestidor perfil,
                                  List<InstituicaoDeclarada> declaradas, List<Dependente> dependentes, List<EventoVida> eventos) {
        clientes.add(new Cliente(id, nome, cpf, 40, "profissão", "Cidade/SP", perfil, "ass-001", true,
                declaradas, dependentes, eventos));
        return this;
    }

    public CenarioBuilder interno(String clienteId) {
        consentimentos.add(new Consentimento("cons-" + clienteId + "-inst-xp", clienteId, "inst-xp",
                TipoConsentimento.INTERNO, StatusConsentimento.ATIVO, List.of(Escopo.values()), REF.minusYears(2), null));
        return this;
    }

    public CenarioBuilder consentimento(String clienteId, String inst, StatusConsentimento status, LocalDate expira, Escopo... escopos) {
        consentimentos.add(new Consentimento("cons-" + clienteId + "-" + inst, clienteId, inst, TipoConsentimento.OPEN_FINANCE,
                status, Arrays.asList(escopos), status == StatusConsentimento.ATIVO ? REF.minusMonths(6) : null,
                status == StatusConsentimento.ATIVO ? expira : null));
        return this;
    }

    public String conta(String clienteId, String inst, TipoConta tipo, double saldo) {
        String id = "cta-" + clienteId + "-" + inst;
        contas.add(new Conta(id, clienteId, inst, tipo, r(saldo)));
        return id;
    }

    /** Uma transação por mês, nos 6 meses completos antes do mês de referência. */
    public CenarioBuilder mensal(String contaId, TipoTransacao tipo, Modalidade mod, String descricao, double valor, int dia,
                                 String docContraparte, String nomeContraparte) {
        YearMonth ref = YearMonth.from(REF);
        for (int i = 1; i <= 6; i++) {
            LocalDate d = ref.minusMonths(i).atDay(dia);
            transacoes.add(new Transacao("tx-" + (++seq), contaId, d, r(valor), tipo, mod, descricao, docContraparte, nomeContraparte));
        }
        return this;
    }

    public CenarioBuilder debitoMensal(String contaId, String descricao, double valor) {
        Modalidade mod = descricao.startsWith("COMPRA") ? Modalidade.CARTAO_DEBITO
                : descricao.startsWith("APLICACAO") || descricao.startsWith("FATURA") || descricao.startsWith("PARCELA")
                ? Modalidade.OUTRO : Modalidade.BOLETO;
        return mensal(contaId, TipoTransacao.DEBITO, mod, descricao, valor, 10, null, null);
    }

    public CenarioBuilder transacao(String contaId, LocalDate data, TipoTransacao tipo, Modalidade mod, String descricao,
                                    double valor, String doc) {
        transacoes.add(new Transacao("tx-" + (++seq), contaId, data, r(valor), tipo, mod, descricao, doc, null));
        return this;
    }

    public CenarioBuilder faturasMensais(String clienteId, String inst, double valor) {
        YearMonth ref = YearMonth.from(REF);
        for (int i = 1; i <= 6; i++) {
            faturas.add(new FaturaCartao("fat-" + (++seq), clienteId, inst, ref.minusMonths(i).toString(), r(valor)));
        }
        return this;
    }

    public CenarioBuilder credito(String clienteId, String inst, TipoCredito tipo, double saldo, double parcela) {
        creditos.add(new OperacaoCredito("cred-" + (++seq), clienteId, inst, tipo, r(saldo), r(parcela), new BigDecimal("0.11")));
        return this;
    }

    public CenarioBuilder posicao(String clienteId, String inst, String emissor, Produto produto, String nome, double valor,
                                  LocalDate vencimento, boolean liquidezDiaria) {
        investimentos.add(new PosicaoInvestimento("pos-" + (++seq), clienteId, inst, emissor, produto, nome,
                r(valor * 0.9), r(valor), REF.minusYears(1), vencimento, Indexador.CDI, "100% CDI", liquidezDiaria));
        return this;
    }

    public Seed build() {
        return new Seed(List.copyOf(instituicoes), List.copyOf(emissores), List.copyOf(clientes), List.copyOf(consentimentos),
                List.copyOf(contas), List.copyOf(transacoes), List.copyOf(faturas), List.copyOf(creditos), List.copyOf(investimentos));
    }
}
