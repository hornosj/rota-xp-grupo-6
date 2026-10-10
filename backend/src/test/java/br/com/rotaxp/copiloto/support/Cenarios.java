package br.com.rotaxp.copiloto.support;

import static br.com.rotaxp.copiloto.support.CenarioBuilder.REF;
import static br.com.rotaxp.copiloto.support.CenarioBuilder.decl;

import br.com.rotaxp.copiloto.dominio.Cliente.Dependente;
import br.com.rotaxp.copiloto.dominio.Enums.Escopo;
import br.com.rotaxp.copiloto.dominio.Enums.Modalidade;
import br.com.rotaxp.copiloto.dominio.Enums.PerfilInvestidor;
import br.com.rotaxp.copiloto.dominio.Enums.Produto;
import br.com.rotaxp.copiloto.dominio.Enums.ProdutoDeclarado;
import br.com.rotaxp.copiloto.dominio.Enums.StatusConsentimento;
import br.com.rotaxp.copiloto.dominio.Enums.TipoConta;
import br.com.rotaxp.copiloto.dominio.Enums.TipoCredito;
import br.com.rotaxp.copiloto.dominio.Enums.TipoTransacao;
import java.time.LocalDate;
import java.util.List;

/** Clientes-âncora do PLAN §6.3, reproduzidos à mão para testes unitários. */
public final class Cenarios {

    public static final String CPF_MARINA = "111.111.111-11";
    public static final String CPF_JULIANA = "333.333.333-33";

    private Cenarios() {}

    /** cli-001 — Dra. Marina Costa. Horizonte PENDENTE. */
    public static CenarioBuilder marina(CenarioBuilder b) {
        b.cliente("cli-001", "Dra. Marina Costa", CPF_MARINA, PerfilInvestidor.ARROJADO,
                List.of(decl("inst-xp", ProdutoDeclarado.INVESTIMENTOS),
                        decl("inst-aurora", ProdutoDeclarado.CONTA, ProdutoDeclarado.CARTAO, ProdutoDeclarado.CREDITO),
                        decl("inst-horizonte", ProdutoDeclarado.INVESTIMENTOS)),
                List.of(new Dependente("Sofia", "filha", LocalDate.of(2014, 10, 16)),
                        new Dependente("Pedro", "filho", LocalDate.of(2017, 3, 2))),
                List.of());
        b.interno("cli-001")
                .consentimento("cli-001", "inst-aurora", StatusConsentimento.ATIVO, REF.plusDays(300),
                        Escopo.CONTAS, Escopo.CARTOES, Escopo.CREDITO)
                .consentimento("cli-001", "inst-horizonte", StatusConsentimento.PENDENTE, null, Escopo.INVESTIMENTOS);
        String cc = b.conta("cli-001", "inst-aurora", TipoConta.CORRENTE, 85_000);
        b.mensal(cc, TipoTransacao.CREDITO, Modalidade.TED, "SALARIO HOSPITAL SANTA CLARA", 38_000, 5,
                        "11.222.333/0001-01", "HOSPITAL SANTA CLARA")
                .debitoMensal(cc, "CONDOMINIO", 2_800)
                .debitoMensal(cc, "ENERGIA", 450)
                .debitoMensal(cc, "INTERNET", 150)
                .debitoMensal(cc, "ESCOLA", 3_200)
                .debitoMensal(cc, "PARCELA FINANCIAMENTO", 6_500)
                .debitoMensal(cc, "COMPRA DEBITO MERCADO", 1_900)
                .debitoMensal(cc, "FATURA CARTAO AURORA", 9_000)
                .debitoMensal(cc, "APLICACAO XP", 5_000)
                .faturasMensais("cli-001", "inst-aurora", 9_000)
                .credito("cli-001", "inst-aurora", TipoCredito.IMOBILIARIO, 620_000, 6_500)
                .posicao("cli-001", "inst-xp", "emi-tesouro", Produto.TESOURO, "Tesouro IPCA+ 2035", 280_000, LocalDate.of(2035, 5, 15), false)
                .posicao("cli-001", "inst-xp", null, Produto.FUNDO, "Fundo Multimercado", 260_000, null, false)
                .posicao("cli-001", "inst-xp", "emi-ipe", Produto.CDB, "CDB Banco Ipê 2028", 160_000, LocalDate.of(2028, 6, 1), false)
                .posicao("cli-001", "inst-xp", "emi-ipe", Produto.CDB, "CDB Banco Ipê Liquidez Diária", 70_000, null, true)
                .posicao("cli-001", "inst-xp", null, Produto.ACAO, "Carteira de ações", 130_000, null, false)
                .posicao("cli-001", "inst-horizonte", "emi-horizonte", Produto.CDB, "CDB Banco Horizonte", 650_000,
                        LocalDate.of(2029, 1, 10), false);
        return b;
    }

    /** cli-003 — Juliana Prado. Cartão Aurora PENDENTE (fatura paga do Ipê vira proxy). */
    public static CenarioBuilder juliana(CenarioBuilder b) {
        b.cliente("cli-003", "Juliana Prado", CPF_JULIANA, PerfilInvestidor.MODERADO,
                List.of(decl("inst-xp", ProdutoDeclarado.INVESTIMENTOS),
                        decl("inst-ipe", ProdutoDeclarado.CONTA),
                        decl("inst-aurora", ProdutoDeclarado.CARTAO)),
                List.of(), List.of());
        b.interno("cli-003")
                .consentimento("cli-003", "inst-ipe", StatusConsentimento.ATIVO, REF.plusDays(200), Escopo.CONTAS)
                .consentimento("cli-003", "inst-aurora", StatusConsentimento.PENDENTE, null, Escopo.CARTOES);
        String cc = b.conta("cli-003", "inst-ipe", TipoConta.CORRENTE, 22_000);
        b.mensal(cc, TipoTransacao.CREDITO, Modalidade.TED, "SALARIO TECHVALE SISTEMAS", 14_000, 5,
                        "22.333.444/0001-02", "TECHVALE SISTEMAS")
                .debitoMensal(cc, "ALUGUEL", 2_900)
                .debitoMensal(cc, "ENERGIA", 180)
                .debitoMensal(cc, "INTERNET", 120)
                .debitoMensal(cc, "ACADEMIA", 150)
                .debitoMensal(cc, "COMPRA DEBITO MERCADO", 2_650)
                .debitoMensal(cc, "FATURA CARTAO AURORA", 3_000)
                .debitoMensal(cc, "APLICACAO XP", 1_000)
                .faturasMensais("cli-003", "inst-aurora", 3_000)
                .posicao("cli-003", "inst-xp", "emi-ipe", Produto.CDB, "CDB Ipê Liquidez Diária", 5_000, null, true)
                .posicao("cli-003", "inst-xp", null, Produto.FUNDO, "Fundo", 35_000, null, false)
                .posicao("cli-003", "inst-xp", "emi-tesouro", Produto.TESOURO, "Tesouro IPCA+", 20_000, LocalDate.of(2032, 8, 15), false);
        return b;
    }
}
