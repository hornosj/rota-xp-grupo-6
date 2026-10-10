package br.com.rotaxp.copiloto.dominio;

public final class Enums {
    private Enums() {}

    public enum PerfilInvestidor { CONSERVADOR, MODERADO, ARROJADO, AGRESSIVO }
    public enum ProdutoDeclarado { CONTA, CARTAO, CREDITO, INVESTIMENTOS }
    public enum Escopo { CONTAS, CARTOES, CREDITO, INVESTIMENTOS }
    public enum TipoEmissor { BANCO, EMPRESA, TESOURO }
    public enum TipoEventoVida { ANIVERSARIO, CASAMENTO, NASCIMENTO, FERIAS, APOSENTADORIA, MUDANCA, OUTRO }
    public enum OrigemEvento { CADASTRO, NOTA_REUNIAO }
    public enum OrigemAnotacao { AUDIO, TEXTO }
    public enum TipoNecessidade {
        PROTECAO_VEICULO, PROTECAO_VIDA, PROTECAO_RESIDENCIAL, SAUDE, RESERVA_EMERGENCIA, EDUCACAO,
        APOSENTADORIA, COMPRA_IMOVEL, COMPRA_VEICULO, VIAGEM, SUCESSAO
    }
    public enum TipoConsentimento { OPEN_FINANCE, INTERNO }
    public enum StatusConsentimento { ATIVO, PENDENTE, EXPIRADO, REVOGADO }
    public enum TipoConta { CORRENTE, PAGAMENTO }
    public enum TipoTransacao { CREDITO, DEBITO }
    public enum Modalidade { PIX, TED, BOLETO, DEBITO_AUTOMATICO, CARTAO_DEBITO, TARIFA, OUTRO }
    public enum TipoCredito { IMOBILIARIO, VEICULO, PESSOAL, CONSIGNADO, RURAL }
    public enum Produto { CDB, RDB, LCI, LCA, LC, POUPANCA, TESOURO, DEBENTURE, CRI, CRA, FUNDO, ACAO, PREVIDENCIA }
    public enum Indexador { CDI, IPCA, PRE, SELIC, NA }
    public enum PosicaoXp { PRINCIPAL, SECUNDARIA, SO_INVESTIMENTOS, AUSENTE }
    public enum Severidade { ALTA, MEDIA, BAIXA }
    public enum TipoAlerta {
        FGC_EXCEDIDO, FGC_TETO_GLOBAL, CONCENTRACAO_EMISSOR, VENCIMENTO_PROXIMO, SALDO_PARADO,
        RENDA_FORA_XP, CONSENTIMENTO_EXPIRANDO, EVENTO_VIDA_PROXIMO, RESERVA_INSUFICIENTE
    }
    public enum TipoAcao {
        DIVERSIFICAR_FGC, REDUZIR_CONCENTRACAO, APLICAR_SALDO_PARADO, APORTE_PROGRAMADO,
        REINVESTIR_VENCIMENTO, RENOVAR_CONSENTIMENTO, CONTATO_RELACIONAMENTO, CONVIDAR_CONEXAO, MONTAR_RESERVA
    }
    public enum Canal { WHATSAPP, EMAIL }
    public enum GeradoPor { stub, cache, live }
}
