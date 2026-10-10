package br.com.rotaxp.copiloto.agentes;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.rotaxp.copiloto.agentes.AgentesTipos.ContextoNoticia;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.MotivoRedigido;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.PedidoMotivoNoticia;
import br.com.rotaxp.copiloto.config.CopilotoProps;
import br.com.rotaxp.copiloto.consolidacao.Visao360Assembler;
import br.com.rotaxp.copiloto.dominio.Enums.GeradoPor;
import br.com.rotaxp.copiloto.dominio.Excecoes.NaoEncontrado;
import br.com.rotaxp.copiloto.dominio.Radar.MotivoNoticia;
import br.com.rotaxp.copiloto.inteligencia.radar.ClassificadorLlm;
import br.com.rotaxp.copiloto.inteligencia.radar.ClassificadorRegras;
import br.com.rotaxp.copiloto.inteligencia.radar.CruzamentoCarteira;
import br.com.rotaxp.copiloto.inteligencia.radar.FonteCurada;
import br.com.rotaxp.copiloto.inteligencia.radar.RadarService;
import br.com.rotaxp.copiloto.inteligencia.radar.RadarServiceTest;
import br.com.rotaxp.copiloto.openfinance.ConsentimentoAlterado;
import br.com.rotaxp.copiloto.support.CenarioBuilder;
import br.com.rotaxp.copiloto.support.Cenarios;
import br.com.rotaxp.copiloto.support.Infra;
import br.com.rotaxp.copiloto.support.Pilha;
import com.embabel.agent.test.unit.FakeOperationContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/** Motivo de contato a partir de uma notícia que mexe na carteira (texto para o assessor). */
class MotivoNoticiaTest {

    @TempDir Path dir;
    private final ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
    private ContextoNoticiaFactory contextosNoticia;
    private CopilotoStub stub;

    @BeforeEach
    void setUp() {
        Infra i = new Infra(Cenarios.marina(CenarioBuilder.comInstituicoesPadrao()).build());
        Visao360Assembler assembler = new Pilha().assembler(i);
        var p = RadarServiceTest.props("referencia");
        RadarService radar = new RadarService(List.of(new FonteCurada(mapper)), new ClassificadorRegras(),
                new ClassificadorLlm(new ExecutorAgentes() {
                    @Override public <T> T executar(Object e, Class<T> t) { return null; }
                }, new ClassificadorRegras(), p.modeloClassificacao(), p.tamanhoLote()),
                new CruzamentoCarteira(p.fracaoPlena(), p.pontosMinimos()), i.gateway, i.repo, i.dataReferencia,
                Infra.demoProps(), p, e -> { });
        radar.processar();
        i.consentimentos.conceder("cli-001", "inst-horizonte");
        assembler.aoAlterarConsentimento(new ConsentimentoAlterado("cli-001", "inst-horizonte"));
        ContextoClienteFactory contextos = new ContextoClienteFactory(assembler, i.dataReferencia);
        contextosNoticia = new ContextoNoticiaFactory(contextos, radar);
        stub = new CopilotoStub(contextos, contextosNoticia);
    }

    @Test
    void contextoJuntaClienteNoticiaEImpacto() {
        ContextoNoticia c = contextosNoticia.para("cli-001", "not-002");

        assertThat(c.cliente().primeiroNome()).isEqualTo("Marina");
        assertThat(c.titulo()).isEqualTo("Agência rebaixa rating do Banco Horizonte de A para BBB");
        assertThat(c.impacto().motivo()).startsWith("R$ 650 mil em CDB do Banco Horizonte");
        assertThat(c.direcao()).isEqualTo("NEGATIVA");
    }

    @Test
    void noticiaQueNaoMexeNaCarteiraEhNaoEncontrada() {
        assertThatThrownBy(() -> contextosNoticia.para("cli-001", "not-001")).isInstanceOf(NaoEncontrado.class);
    }

    @Test
    void stubEscreveOMotivoParaOAssessor() {
        MotivoNoticia m = stub.redigirMotivoNoticia("cli-001", "not-002");

        assertThat(m.geradoPor()).isEqualTo(GeradoPor.stub);
        assertThat(m.texto()).contains("Marina", "R$ 650 mil em CDB do Banco Horizonte", "rebaixa rating")
                .hasSizeLessThanOrEqualTo(600).doesNotContain("garant", "rentabilidade");
    }

    @Test
    void agenteRedigeComOModeloDoCopilotoESemInventarNumeros() {
        AgenteRadarNoticias agente = new AgenteRadarNoticias(contextosNoticia,
                new CopilotoProps("live", "deepseek/deepseek-v4-pro", "./llm-cache", "x", 1024), mapper);
        ContextoNoticia c = agente.montarContexto(new PedidoMotivoNoticia("cli-001", "not-002"));
        FakeOperationContext ctx = FakeOperationContext.create();
        ctx.expectResponse(new MotivoRedigido("  Ligar para a Marina hoje.  "));

        MotivoNoticia m = agente.redigir(c, ctx);

        assertThat(m.texto()).isEqualTo("Ligar para a Marina hoje.");
        assertThat(m.geradoPor()).isEqualTo(GeradoPor.live);
        assertThat(ctx.getLlmInvocations().get(0).getInteraction().getLlm().getModel()).isEqualTo("deepseek/deepseek-v4-pro");
        assertThat(ctx.getLlmInvocations().get(0).getInteraction().getLlm().getMaxTokens()).isEqualTo(1024);
        assertThat(ctx.getLlmInvocations().get(0).getPrompt()).contains("R$ 650 mil", "rebaixa rating");
    }

    @Test
    void cacheDevolveOGravadoERoteadorSemChaveUsaStub() {
        CacheLlm cache = new CacheLlm(dir, mapper);
        ContextoClienteFactory contextos = null;   // não usado nos caminhos de notícia
        CopilotoLive live = new CopilotoLive(new ExecutorAgentes() {
            @Override public <T> T executar(Object entrada, Class<T> tipo) { return tipo.cast(new MotivoNoticia("Do agente.", GeradoPor.live)); }
        }, stub);
        CopilotoRecord record = new CopilotoRecord(live, cache, contextos, contextosNoticia);
        CopilotoCache emCache = new CopilotoCache(cache, contextos, contextosNoticia, stub);

        record.redigirMotivoNoticia("cli-001", "not-002");
        assertThat(emCache.redigirMotivoNoticia("cli-001", "not-002"))
                .isEqualTo(new MotivoNoticia("Do agente.", GeradoPor.cache));

        CopilotoRouter router = new CopilotoRouter(new CopilotoProps("live", "m", dir.toString(), "", 1024),
                stub, emCache, live, record);
        assertThat(router.redigirMotivoNoticia("cli-001", "not-002").geradoPor()).isEqualTo(GeradoPor.stub);
    }
}
