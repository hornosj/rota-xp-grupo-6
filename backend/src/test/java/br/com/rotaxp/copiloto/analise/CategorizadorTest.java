package br.com.rotaxp.copiloto.analise;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotaxp.copiloto.dominio.Enums.Modalidade;
import br.com.rotaxp.copiloto.dominio.Enums.TipoTransacao;
import br.com.rotaxp.copiloto.dominio.Transacao;
import br.com.rotaxp.copiloto.support.CenarioBuilder;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class CategorizadorTest {

    private static final String CPF = "111.111.111-11";
    private final Categorizador categorizador = new Categorizador();

    private static Transacao tx(TipoTransacao tipo, Modalidade mod, String descricao, String doc) {
        return new Transacao("t", "c", CenarioBuilder.REF, BigDecimal.TEN, tipo, mod, descricao, doc, null);
    }

    @Test
    void transferenciaParaOProprioCpfVemAntesDeTudo() {
        assertThat(categorizador.categorizar(tx(TipoTransacao.DEBITO, Modalidade.PIX, "APLICACAO XP", CPF), CPF))
                .isEqualTo(Categoria.TRANSFERENCIA_PROPRIA);
    }

    @ParameterizedTest
    @CsvSource({
            "DEBITO, OUTRO, APLICACAO XP, APLICACAO",
            "CREDITO, OUTRO, RESGATE XP, RESGATE",
            "DEBITO, OUTRO, FATURA CARTAO AURORA, PAGAMENTO_FATURA",
            "DEBITO, OUTRO, PARCELA FINANCIAMENTO, PARCELA_CREDITO",
            "DEBITO, BOLETO, LOJA QUALQUER, CONTA_RECORRENTE",
            "DEBITO, DEBITO_AUTOMATICO, AGUA, CONTA_RECORRENTE",
            "DEBITO, PIX, CONDOMINIO, CONTA_RECORRENTE",
            "DEBITO, OUTRO, PLANO DE SAUDE, CONTA_RECORRENTE",
            "CREDITO, TED, SALARIO HOSPITAL SANTA CLARA, CREDITO_CANDIDATO_RENDA",
            "DEBITO, CARTAO_DEBITO, COMPRA DEBITO MERCADO, CONSUMO",
            "DEBITO, PIX, PIX ENVIADO JOAO, CONSUMO",
            "DEBITO, TARIFA, TARIFA PACOTE, CONSUMO",
    })
    void aplicaAsRegrasEmOrdem(TipoTransacao tipo, Modalidade mod, String descricao, Categoria esperada) {
        assertThat(categorizador.categorizar(tx(tipo, mod, descricao, "99.999.999/0001-99"), CPF)).isEqualTo(esperada);
    }

    @ParameterizedTest
    @CsvSource({
            "FATURA CARTAO AURORA, inst-aurora",
            "FATURA CARTAO IPE, inst-ipe",
            "FATURA CARTAO XP, inst-xp",
            "FATURA CARTAO HORIZONTE, inst-horizonte",
    })
    void identificaOBancoDoCartaoPelaDescricao(String descricao, String instituicao) {
        var instituicoes = CenarioBuilder.comInstituicoesPadrao().build().instituicoes();

        assertThat(categorizador.bancoDaFatura(descricao, instituicoes)).isEqualTo(instituicao);
    }
}
