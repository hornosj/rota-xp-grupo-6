package br.com.rotaxp.copiloto.analise;

import static br.com.rotaxp.copiloto.support.CenarioBuilder.REF;
import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotaxp.copiloto.config.RendaProps;
import br.com.rotaxp.copiloto.dominio.Enums.Modalidade;
import br.com.rotaxp.copiloto.dominio.Enums.PerfilInvestidor;
import br.com.rotaxp.copiloto.dominio.Enums.TipoConta;
import br.com.rotaxp.copiloto.dominio.Enums.TipoTransacao;
import br.com.rotaxp.copiloto.dominio.FluxoCaixa.FonteRenda;
import br.com.rotaxp.copiloto.support.CenarioBuilder;
import br.com.rotaxp.copiloto.support.Cenarios;
import br.com.rotaxp.copiloto.support.Infra;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class DetectorRendaTest {

    private final DetectorRenda detector = new DetectorRenda(new Categorizador(), new RendaProps(3, 0.15, 6, 3));

    private List<FonteRenda> detectar(CenarioBuilder b, String clienteId) {
        Infra i = new Infra(b.build());
        return detector.detectar(i.gateway.dados(clienteId), REF);
    }

    private static CenarioBuilder clienteSimples() {
        CenarioBuilder b = CenarioBuilder.comInstituicoesPadrao();
        b.cliente("cli-x", "Fulano de Tal", "999.000.000-00", PerfilInvestidor.MODERADO, List.of(), List.of(), List.of())
                .interno("cli-x");
        return b;
    }

    @Test
    void salarioDaMarinaEhRendaRecorrente() {
        List<FonteRenda> fontes = detectar(Cenarios.marina(CenarioBuilder.comInstituicoesPadrao()), "cli-001");

        assertThat(fontes).hasSize(1);
        FonteRenda f = fontes.get(0);
        assertThat(f.valorMensal()).isEqualByComparingTo("38000");
        assertThat(f.diaDoMes()).isEqualTo(5);
        assertThat(f.instituicaoId()).isEqualTo("inst-aurora");
        assertThat(f.pagadorNome()).isEqualTo("HOSPITAL SANTA CLARA");
    }

    @Test
    void creditoEmMenosDeTresMesesNaoEhRenda() {
        CenarioBuilder b = clienteSimples();
        String c = b.conta("cli-x", "inst-xp", TipoConta.PAGAMENTO, 1000);
        b.transacao(c, REF.minusMonths(2).withDayOfMonth(3), TipoTransacao.CREDITO, Modalidade.PIX, "PIX RECEBIDO", 5000, "01")
                .transacao(c, REF.minusMonths(3).withDayOfMonth(3), TipoTransacao.CREDITO, Modalidade.PIX, "PIX RECEBIDO", 5000, "01");

        assertThat(detectar(b, "cli-x")).isEmpty();
    }

    @Test
    void valoresForaDaToleranciaDaMedianaNaoContam() {
        CenarioBuilder b = clienteSimples();
        String c = b.conta("cli-x", "inst-xp", TipoConta.PAGAMENTO, 1000);
        // 3 meses: 10.000, 10.000 e 20.000 → só 2 meses dentro de ±15% da mediana
        b.transacao(c, REF.minusMonths(1).withDayOfMonth(5), TipoTransacao.CREDITO, Modalidade.TED, "PRO LABORE X", 10000, "02")
                .transacao(c, REF.minusMonths(2).withDayOfMonth(5), TipoTransacao.CREDITO, Modalidade.TED, "PRO LABORE X", 10000, "02")
                .transacao(c, REF.minusMonths(3).withDayOfMonth(5), TipoTransacao.CREDITO, Modalidade.TED, "PRO LABORE X", 20000, "02");

        assertThat(detectar(b, "cli-x")).isEmpty();
    }

    @Test
    void creditosForaDaJanelaDeSeisMesesSaoIgnorados() {
        CenarioBuilder b = clienteSimples();
        String c = b.conta("cli-x", "inst-xp", TipoConta.PAGAMENTO, 1000);
        b.transacao(c, REF.withDayOfMonth(1), TipoTransacao.CREDITO, Modalidade.TED, "SALARIO X", 9000, "03")
                .transacao(c, REF.minusMonths(7), TipoTransacao.CREDITO, Modalidade.TED, "SALARIO X", 9000, "03")
                .transacao(c, REF.minusMonths(8), TipoTransacao.CREDITO, Modalidade.TED, "SALARIO X", 9000, "03");

        assertThat(detectar(b, "cli-x")).isEmpty();
    }

    @Test
    void variasFontesETransferenciasPropriasNaoContam() {
        CenarioBuilder b = clienteSimples();
        String c = b.conta("cli-x", "inst-xp", TipoConta.PAGAMENTO, 1000);
        b.mensal(c, TipoTransacao.CREDITO, Modalidade.TED, "SALARIO EMPRESA A", 8000, 5, "04", "EMPRESA A")
                .mensal(c, TipoTransacao.CREDITO, Modalidade.TED, "ALUGUEL RECEBIDO", 2000, 12, "05", "INQUILINO")
                .mensal(c, TipoTransacao.CREDITO, Modalidade.PIX, "PIX RECEBIDO", 3000, 20, "999.000.000-00", "EU MESMO");

        List<FonteRenda> fontes = detectar(b, "cli-x");

        assertThat(fontes).extracting(FonteRenda::valorMensal).usingElementComparator(BigDecimal::compareTo)
                .containsExactlyInAnyOrder(new BigDecimal("8000"), new BigDecimal("2000"));
    }
}
