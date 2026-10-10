package br.com.rotaxp.copiloto.agentes;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotaxp.copiloto.consolidacao.Visao360Assembler;
import br.com.rotaxp.copiloto.dominio.AcaoSugerida;
import br.com.rotaxp.copiloto.dominio.Briefing;
import br.com.rotaxp.copiloto.dominio.Edicao.CamposExtraidos;
import br.com.rotaxp.copiloto.dominio.Enums.Canal;
import br.com.rotaxp.copiloto.dominio.Enums.GeradoPor;
import br.com.rotaxp.copiloto.dominio.Enums.TipoEventoVida;
import br.com.rotaxp.copiloto.dominio.MensagemGerada;
import br.com.rotaxp.copiloto.dominio.ResultadoNota;
import br.com.rotaxp.copiloto.openfinance.ConsentimentoAlterado;
import br.com.rotaxp.copiloto.support.CenarioBuilder;
import br.com.rotaxp.copiloto.support.Cenarios;
import br.com.rotaxp.copiloto.support.Infra;
import br.com.rotaxp.copiloto.support.Pilha;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class CopilotoStubTest {

    private Infra i;
    private Visao360Assembler assembler;
    private CopilotoStub stub;

    @BeforeEach
    void setUp() {
        i = new Infra(Cenarios.juliana(Cenarios.marina(CenarioBuilder.comInstituicoesPadrao())).build());
        assembler = new Pilha().assembler(i);
        stub = new CopilotoStub(new ContextoClienteFactory(assembler, i.dataReferencia), null);
    }

    private void concederHorizonte() {
        i.consentimentos.conceder("cli-001", "inst-horizonte");
        assembler.aoAlterarConsentimento(new ConsentimentoAlterado("cli-001", "inst-horizonte"));
    }

    @Test
    void mensagemDeFgcDaMarinaIgualAoExemploDoPlano() {
        concederHorizonte();

        MensagemGerada m = stub.redigirMensagem("cli-001", "acao-cli-001-fgc_excedido-cong-horizonte", Canal.WHATSAPP);

        assertThat(m.texto()).isEqualTo("Oi, Marina! Tudo bem? Revisando seu patrimônio, vi que R$ 400 mil no Banco Horizonte "
                + "estão acima da cobertura do FGC. Tenho uma sugestão simples para deixar tudo protegido. Podemos falar "
                + "10 minutos amanhã? E já adianto: parabéns antecipado pelo aniversário da Sofia!");
        assertThat(m.canal()).isEqualTo(Canal.WHATSAPP);
        assertThat(m.geradoPor()).isEqualTo(GeradoPor.stub);
    }

    @Test
    void todaAcaoTemMensagemDentroDasRegras() {
        concederHorizonte();
        List<AcaoSugerida> acoes = new ArrayList<>(assembler.analisar("cli-001").acoes());
        acoes.addAll(assembler.analisar("cli-003").acoes());

        for (AcaoSugerida a : acoes) {
            String texto = stub.redigirMensagem(a.clienteId(), a.id(), Canal.WHATSAPP).texto();
            assertThat(texto).as(a.tipo().name()).isNotBlank().hasSizeLessThanOrEqualTo(600)
                    .doesNotContain("*", "#", "garant", "rentabilidade");
        }
    }

    @Test
    void contatoDeRelacionamentoNaoRepeteOEvento() {
        MensagemGerada m = stub.redigirMensagem("cli-001", "acao-cli-001-evento_vida_proximo-dep-sofia", Canal.WHATSAPP);

        assertThat(m.texto()).containsOnlyOnce("Sofia");
    }

    @Test
    void emailTemAssuntoECorpo() {
        concederHorizonte();

        String texto = stub.redigirMensagem("cli-001", "acao-cli-001-fgc_excedido-cong-horizonte", Canal.EMAIL).texto();

        assertThat(texto).startsWith("Assunto: ").contains("\n\nOlá, Marina,\n\n").contains("R$ 400 mil");
    }

    @Test
    void briefingTemCincoTopicosETresPerguntas() {
        Briefing b = stub.gerarBriefing("cli-001");

        assertThat(b.clienteId()).isEqualTo("cli-001");
        assertThat(b.bullets()).hasSize(5);
        assertThat(b.bullets().get(0)).startsWith("Banco Aurora é a instituição principal");
        assertThat(b.perguntasSugeridas()).hasSize(3);
        assertThat(b.perguntasSugeridas().get(0)).contains("Sofia");
        assertThat(b.geradoPor()).isEqualTo(GeradoPor.stub);
    }

    @Test
    void notaExtraiEventosEMetasPorPalavrasChave() {
        ResultadoNota r = stub.processarNota("cli-003",
                "Conversei com a Juliana. Ela vai casar no ano que vem. Quer juntar dinheiro para comprar um apartamento. "
                        + "Disse que agora prefere algo mais conservador.");

        assertThat(r.eventosCriados()).singleElement().satisfies(e -> {
            assertThat(e.tipo()).isEqualTo(TipoEventoVida.CASAMENTO);
            assertThat(e.origem()).isEqualTo(br.com.rotaxp.copiloto.dominio.Enums.OrigemEvento.NOTA_REUNIAO);
        });
        assertThat(r.metas()).singleElement().asString().contains("apartamento");
        assertThat(r.mudancasPerfil()).singleElement().asString().contains("conservador");
        assertThat(r.acoesCriadas()).isNotEmpty();
        assertThat(r.resumo()).isNotBlank();
        assertThat(r.geradoPor()).isEqualTo(GeradoPor.stub);
    }

    // ---------- edição do cadastro por voz ----------

    @Test
    void edicaoEntendeAsFrasesTipicasDoAssessor() {
        CamposExtraidos c = stub.extrairEdicao("cli-003", "A Juliana se mudou para Campinas/SP e agora é diretora "
                + "financeira na Embraer. Ela fez 35 anos semana passada. O nome completo dela é Juliana Prado Lima.");

        assertThat(c.cidade()).isEqualTo("Campinas/SP");
        assertThat(c.profissao()).isEqualTo("diretora financeira na Embraer");
        assertThat(c.idade()).isEqualTo("35");
        assertThat(c.nome()).isEqualTo("Juliana Prado Lima");
        assertThat(c.perfil()).isNull();
        assertThat(c.geradoPor()).isEqualTo(GeradoPor.stub);
    }

    @Test
    void edicaoNaoConfundeCamposParecidos() {
        CamposExtraidos c = stub.extrairEdicao("cli-003", "Ela tem 10 anos de carreira. O perfil dela mudou de moderado "
                + "para arrojado. O nome dela agora é Juliana Prado Lima, e ela continua morando aqui.");

        assertThat(c.idade()).as("10 anos de carreira não é idade").isNull();
        assertThat(c.profissao()).as("\"o nome dela agora é\" não é profissão").isNull();
        assertThat(c.cidade()).isNull();
        assertThat(c.nome()).isEqualTo("Juliana Prado Lima");
        assertThat(c.perfil()).as("vale o último perfil citado").isEqualTo("arrojado");
    }

    @Test
    void edicaoValeAUltimaCorrecaoEArtigoAntesDaCidade() {
        CamposExtraidos c = stub.extrairEdicao("cli-003",
                "Ela vai se mudar para Santos. Aliás, ela se mudou para o Rio de Janeiro. Ela passou a ser gerente de projetos.");

        assertThat(c.cidade()).isEqualTo("Rio de Janeiro");
        assertThat(c.profissao()).isEqualTo("gerente de projetos");
    }

    @Test
    void edicaoSemNadaReconhecivelDevolveTudoNulo() {
        assertThat(stub.extrairEdicao("cli-003", "Liguei para ela hoje e conversamos sobre o mercado."))
                .isEqualTo(new CamposExtraidos(null, null, null, null, null, GeradoPor.stub));
    }
}
