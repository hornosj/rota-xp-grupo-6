package br.com.rotaxp.copiloto.agentes;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotaxp.copiloto.agentes.AgentesTipos.BriefingRedigido;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.CadastroAtual;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.CamposDitos;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.ContextoEdicao;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.PedidoEdicao;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.ContextoBriefing;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.ContextoMensagem;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.ContextoNota;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.EventoExtraido;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.FatosExtraidos;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.MensagemRedigida;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.NotaReuniao;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.PedidoBriefing;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.PedidoMensagem;
import br.com.rotaxp.copiloto.config.CopilotoProps;
import br.com.rotaxp.copiloto.consolidacao.Visao360Assembler;
import br.com.rotaxp.copiloto.dominio.Briefing;
import br.com.rotaxp.copiloto.dominio.Edicao.CamposExtraidos;
import br.com.rotaxp.copiloto.dominio.Enums.Canal;
import br.com.rotaxp.copiloto.dominio.Enums.GeradoPor;
import br.com.rotaxp.copiloto.dominio.Enums.OrigemEvento;
import br.com.rotaxp.copiloto.dominio.Enums.PerfilInvestidor;
import br.com.rotaxp.copiloto.dominio.Enums.TipoEventoVida;
import br.com.rotaxp.copiloto.dominio.MensagemGerada;
import br.com.rotaxp.copiloto.dominio.ResultadoNota;
import br.com.rotaxp.copiloto.openfinance.ConsentimentoAlterado;
import br.com.rotaxp.copiloto.support.CenarioBuilder;
import br.com.rotaxp.copiloto.support.Cenarios;
import br.com.rotaxp.copiloto.support.Infra;
import br.com.rotaxp.copiloto.support.Pilha;
import com.embabel.agent.test.unit.FakeOperationContext;
import com.embabel.agent.test.unit.LlmInvocation;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Ações dos agentes Embabel (PLAN §8.3), testadas com o FakeOperationContext — sem chamar LLM. */
class AgentesEmbabelTest {

    static final String ACAO_FGC = "acao-cli-001-fgc_excedido-cong-horizonte";
    static final String MODELO = "deepseek/deepseek-v4-pro";

    private ContextoClienteFactory contextos;
    private final CopilotoProps props = new CopilotoProps("live", MODELO, "./llm-cache", "sk-teste", 1024);
    private final ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
    private FakeOperationContext ctx;

    @BeforeEach
    void setUp() {
        Infra i = new Infra(Cenarios.juliana(Cenarios.marina(CenarioBuilder.comInstituicoesPadrao())).build());
        Visao360Assembler assembler = new Pilha().assembler(i);
        i.consentimentos.conceder("cli-001", "inst-horizonte");
        assembler.aoAlterarConsentimento(new ConsentimentoAlterado("cli-001", "inst-horizonte"));
        contextos = new ContextoClienteFactory(assembler, i.dataReferencia);
        ctx = FakeOperationContext.create();
    }

    private static String system(LlmInvocation inv) {
        return inv.getInteraction().getPromptContributors().stream()
                .map(pc -> pc.contribution()).collect(Collectors.joining("\n"));
    }

    // ---------- AgenteMensagemCliente ----------

    @Test
    void montarContextoDaMensagemNaoUsaLlm() {
        AgenteMensagemCliente agente = new AgenteMensagemCliente(contextos, props, mapper);

        ContextoMensagem c = agente.montarContexto(new PedidoMensagem("cli-001", ACAO_FGC, Canal.WHATSAPP));

        assertThat(c.canal()).isEqualTo(Canal.WHATSAPP);
        assertThat(c.contexto().acao().valorTexto()).isEqualTo("R$ 400 mil");
        assertThat(ctx.getLlmInvocations()).isEmpty();
    }

    @Test
    void redigirMandaRegrasEContextoEnxutoParaOModeloConfigurado() {
        AgenteMensagemCliente agente = new AgenteMensagemCliente(contextos, props, mapper);
        ContextoMensagem c = agente.montarContexto(new PedidoMensagem("cli-001", ACAO_FGC, Canal.WHATSAPP));
        ctx.expectResponse(new MensagemRedigida("Oi, Marina! Texto do agente."));

        MensagemGerada m = agente.redigir(c, ctx);

        assertThat(m.texto()).isEqualTo("Oi, Marina! Texto do agente.");
        assertThat(m.canal()).isEqualTo(Canal.WHATSAPP);
        assertThat(m.geradoPor()).isEqualTo(GeradoPor.live);
        LlmInvocation inv = ctx.getLlmInvocations().get(0);
        assertThat(inv.getInteraction().getLlm().getModel()).isEqualTo(MODELO);
        assertThat(inv.getInteraction().getLlm().getMaxTokens()).isEqualTo(1024);   // props.maxTokens()
        assertThat(system(inv)).contains("Não prometa rentabilidade", "exatamente como estão no contexto", "600 caracteres");
        assertThat(inv.getPrompt()).contains("WHATSAPP", "R$ 400 mil", "Banco Horizonte", "Aniversário da Sofia")
                .doesNotContain("Juliana", "cli-003");
    }

    @Test
    void redigirLimpaEspacosDaResposta() {
        AgenteMensagemCliente agente = new AgenteMensagemCliente(contextos, props, mapper);
        ctx.expectResponse(new MensagemRedigida("  Olá, Marina.  \n"));

        MensagemGerada m = agente.redigir(agente.montarContexto(new PedidoMensagem("cli-001", ACAO_FGC, Canal.EMAIL)), ctx);

        assertThat(m.texto()).isEqualTo("Olá, Marina.");
        assertThat(m.canal()).isEqualTo(Canal.EMAIL);
    }

    // ---------- AgenteBriefing ----------

    @Test
    void briefingEstruturado() {
        AgenteBriefing agente = new AgenteBriefing(contextos, props, mapper);
        ContextoBriefing c = agente.montarContexto(new PedidoBriefing("cli-001"));
        ctx.expectResponse(new BriefingRedigido(List.of("a", "b", "c", "d", "e"), List.of("p1", "p2", "p3")));

        Briefing b = agente.redigir(c, ctx);

        assertThat(b.clienteId()).isEqualTo("cli-001");
        assertThat(b.bullets()).containsExactly("a", "b", "c", "d", "e");
        assertThat(b.perguntasSugeridas()).containsExactly("p1", "p2", "p3");
        assertThat(b.geradoPor()).isEqualTo(GeradoPor.live);
        assertThat(system(ctx.getLlmInvocations().get(0))).contains("5", "3 perguntas");
        assertThat(ctx.getLlmInvocations().get(0).getPrompt()).contains("Banco Aurora é a instituição principal");
    }

    // ---------- AgenteClassificacaoNoticias ----------

    @Test
    void classificaUmLoteNumaChamadaComOModeloDoLote() {
        AgenteClassificacaoNoticias agente = new AgenteClassificacaoNoticias();
        var lote = new AgentesTipos.LoteNoticias(
                List.of(new br.com.rotaxp.copiloto.dominio.Radar.Noticia("not-001", "f", "Agro Sul adia juros de CRA", "resumo A", null, null),
                        new br.com.rotaxp.copiloto.dominio.Radar.Noticia("not-003", "f", "Copom eleva a Selic", "resumo B", null, null)),
                "openai/gpt-oss-120b", 1500,
                List.of(new AgentesTipos.LoteNoticias.EmissorPermitido("emi-agrosul", "Agro Sul Sementes S.A."),
                        new AgentesTipos.LoteNoticias.EmissorPermitido("emi-horizonte", "Banco Horizonte")));
        var resposta = new AgentesTipos.LoteClassificado(List.of(
                new AgentesTipos.ItemClassificado("not-001", List.of("emi-agrosul"), List.of(), List.of("CRA"), "NEGATIVA", 0.9, "x")));
        ctx.expectResponse(resposta);

        AgentesTipos.LoteClassificado r = agente.classificar(lote, ctx);

        assertThat(r).isEqualTo(resposta);
        assertThat(ctx.getLlmInvocations()).hasSize(1);
        LlmInvocation inv = ctx.getLlmInvocations().get(0);
        assertThat(inv.getInteraction().getLlm().getModel()).isEqualTo("openai/gpt-oss-120b");
        assertThat(inv.getInteraction().getLlm().getMaxTokens()).isEqualTo(1500);
        assertThat(inv.getPrompt()).contains("not-001", "Agro Sul adia juros de CRA", "not-003", "Copom eleva a Selic");
        assertThat(system(inv)).contains("emi-agrosul", "emi-horizonte", "SELIC", "DEBENTURE", "NEGATIVA");
    }

    // ---------- AgenteNotaPosReuniao ----------

    @Test
    void notaExtraiFatosComLlmEPlanejaFollowUpPorRegra() {
        AgenteNotaPosReuniao agente = new AgenteNotaPosReuniao(contextos, props, mapper);
        ContextoNota c = agente.montarContexto(new NotaReuniao("cli-003", "Ela vai casar em maio de 2027."));
        assertThat(c.dataReferencia()).isEqualTo(CenarioBuilder.REF);
        ctx.expectResponse(new FatosExtraidos("Juliana vai casar.",
                List.of(new EventoExtraido("CASAMENTO", "Casamento da Juliana", "2027-05-15"),
                        new EventoExtraido("INVALIDO", "Algo", "sem data")),
                List.of("Comprar apartamento"), List.of(),
                List.of(new AgentesTipos.NecessidadeExtraida("PROTECAO_VEICULO", "  Bateu o carro ", true),
                        new AgentesTipos.NecessidadeExtraida("INVALIDA", "x", null),
                        new AgentesTipos.NecessidadeExtraida("protecao_veiculo", "repetida", false),
                        new AgentesTipos.NecessidadeExtraida("LUTO", "x".repeat(300), null))));

        FatosExtraidos fatos = agente.extrairFatos(c, ctx);
        ResultadoNota r = agente.planejarFollowUp(fatos, c);

        assertThat(ctx.getLlmInvocations().get(0).getPrompt()).contains("Ela vai casar em maio de 2027.", "2026-10-11");
        assertThat(r.resumo()).isEqualTo("Juliana vai casar.");
        assertThat(r.eventosCriados()).hasSize(2);
        assertThat(r.eventosCriados().get(0).tipo()).isEqualTo(TipoEventoVida.CASAMENTO);
        assertThat(r.eventosCriados().get(0).data()).isEqualTo(LocalDate.of(2027, 5, 15));
        assertThat(r.eventosCriados().get(0).origem()).isEqualTo(OrigemEvento.NOTA_REUNIAO);
        assertThat(r.eventosCriados().get(1).tipo()).isEqualTo(TipoEventoVida.OUTRO);
        assertThat(r.eventosCriados().get(1).data()).isEqualTo(CenarioBuilder.REF.plusDays(180));
        assertThat(r.metas()).containsExactly("Comprar apartamento");
        assertThat(r.acoesCriadas()).singleElement().satisfies(a -> assertThat(a.titulo()).contains("resumo da reunião"));
        assertThat(r.necessidades()).hasSize(2);
        assertThat(r.necessidades().get(0)).isEqualTo(new br.com.rotaxp.copiloto.dominio.Necessidade(
                br.com.rotaxp.copiloto.dominio.Enums.TipoNecessidade.PROTECAO_VEICULO, "Bateu o carro", true));
        assertThat(r.necessidades().get(1).jaPossui()).isFalse();
        assertThat(r.necessidades().get(1).motivo()).hasSizeLessThanOrEqualTo(AgenteNotaPosReuniao.MAX_MOTIVO);
        assertThat(r.recomendacoes()).isEmpty();   // produto vem do catálogo, no NotaService
        String sys = system(ctx.getLlmInvocations().get(0));
        assertThat(sys).contains("necessidades", "jaPossui", "Open Finance");
        for (var t : br.com.rotaxp.copiloto.dominio.Enums.TipoNecessidade.values()) assertThat(sys).contains(t.name());
        assertThat(r.geradoPor()).isEqualTo(GeradoPor.live);
    }

    // ---------- AgenteEdicaoCadastro ----------

    @Test
    void edicaoMandaCadastroAtualETranscricaoSemCpfEDevolveOsCamposDitos() {
        AgenteEdicaoCadastro agente = new AgenteEdicaoCadastro(contextos, props, mapper);
        ContextoEdicao c = agente.montarContexto(new PedidoEdicao("cli-003", "Ela se mudou para Campinas."));
        assertThat(c.cadastro()).isEqualTo(new CadastroAtual("Juliana Prado", 40, "profissão", "Cidade/SP", PerfilInvestidor.MODERADO));
        assertThat(ctx.getLlmInvocations()).isEmpty();
        ctx.expectResponse(new CamposDitos(null, null, null, "Campinas/SP", null));

        CamposExtraidos r = agente.extrair(c, ctx);

        assertThat(r).isEqualTo(new CamposExtraidos(null, null, null, "Campinas/SP", null, GeradoPor.live));
        LlmInvocation inv = ctx.getLlmInvocations().get(0);
        assertThat(inv.getInteraction().getLlm().getModel()).isEqualTo(MODELO);
        assertThat(system(inv)).contains("Cidade/UF", "Não invente", "CONSERVADOR, MODERADO, ARROJADO, AGRESSIVO")
                .doesNotContain("Não prometa rentabilidade");
        assertThat(inv.getPrompt()).contains("Juliana Prado", "Ela se mudou para Campinas.")
                .doesNotContain(Cenarios.CPF_JULIANA, "Marina");
    }
}
