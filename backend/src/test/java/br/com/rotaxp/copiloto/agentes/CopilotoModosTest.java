package br.com.rotaxp.copiloto.agentes;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotaxp.copiloto.config.CopilotoProps;
import br.com.rotaxp.copiloto.consolidacao.Visao360Assembler;
import br.com.rotaxp.copiloto.dominio.Briefing;
import br.com.rotaxp.copiloto.dominio.Edicao.CamposExtraidos;
import br.com.rotaxp.copiloto.dominio.Enums.Canal;
import br.com.rotaxp.copiloto.dominio.Enums.GeradoPor;
import br.com.rotaxp.copiloto.dominio.MensagemGerada;
import br.com.rotaxp.copiloto.dominio.ResultadoNota;
import br.com.rotaxp.copiloto.openfinance.ConsentimentoAlterado;
import br.com.rotaxp.copiloto.support.CenarioBuilder;
import br.com.rotaxp.copiloto.support.Cenarios;
import br.com.rotaxp.copiloto.support.Infra;
import br.com.rotaxp.copiloto.support.Pilha;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class CopilotoModosTest {

    static final String ACAO_FGC = "acao-cli-001-fgc_excedido-cong-horizonte";

    /** Executor falso: registra as entradas e devolve respostas fixas (ou falha). */
    static class ExecutorFalso implements ExecutorAgentes {
        final List<Object> entradas = new ArrayList<>();
        Object resposta;
        RuntimeException erro;

        @Override public <T> T executar(Object entrada, Class<T> resultado) {
            entradas.add(entrada);
            if (erro != null) throw erro;
            return resultado.cast(resposta);
        }
    }

    @TempDir Path dir;
    private final ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
    private final ExecutorFalso agentes = new ExecutorFalso();
    private ContextoClienteFactory contextos;
    private CopilotoStub stub;
    private CacheLlm cache;
    private CopilotoLive live;

    @BeforeEach
    void setUp() {
        Infra i = new Infra(Cenarios.juliana(Cenarios.marina(CenarioBuilder.comInstituicoesPadrao())).build());
        Visao360Assembler assembler = new Pilha().assembler(i);
        i.consentimentos.conceder("cli-001", "inst-horizonte");
        assembler.aoAlterarConsentimento(new ConsentimentoAlterado("cli-001", "inst-horizonte"));
        contextos = new ContextoClienteFactory(assembler, i.dataReferencia);
        stub = new CopilotoStub(contextos, null);
        cache = new CacheLlm(dir, mapper);
        live = new CopilotoLive(agentes, stub);
        agentes.resposta = new MensagemGerada("Oi, Marina! Texto do agente.", Canal.WHATSAPP, GeradoPor.live);
    }

    // ---------- live (agentes Embabel) ----------

    @Test
    void liveInvocaOAgenteDeMensagemComOPedido() {
        MensagemGerada m = live.redigirMensagem("cli-001", ACAO_FGC, Canal.WHATSAPP);

        assertThat(m.texto()).isEqualTo("Oi, Marina! Texto do agente.");
        assertThat(m.geradoPor()).isEqualTo(GeradoPor.live);
        assertThat(agentes.entradas).containsExactly(new AgentesTipos.PedidoMensagem("cli-001", ACAO_FGC, Canal.WHATSAPP));
    }

    @Test
    void liveBriefingEValidado() {
        agentes.resposta = new Briefing("cli-001", List.of("a", "b", "c", "d", "e"), List.of("p1", "p2", "p3"), GeradoPor.live);

        Briefing b = live.gerarBriefing("cli-001");

        assertThat(b.bullets()).hasSize(5);
        assertThat(b.geradoPor()).isEqualTo(GeradoPor.live);
        assertThat(agentes.entradas).containsExactly(new AgentesTipos.PedidoBriefing("cli-001"));
    }

    @Test
    void liveComRespostaIncompletaCaiNoStub() {
        agentes.resposta = new Briefing("cli-001", List.of(), List.of(), GeradoPor.live);

        assertThat(live.gerarBriefing("cli-001").geradoPor()).isEqualTo(GeradoPor.stub);
    }

    @Test
    void liveComFalhaDoAgenteCaiNoStub() {
        agentes.erro = new IllegalStateException("401 sem chave");

        assertThat(live.redigirMensagem("cli-001", ACAO_FGC, Canal.WHATSAPP).geradoPor()).isEqualTo(GeradoPor.stub);
        assertThat(live.gerarBriefing("cli-001").geradoPor()).isEqualTo(GeradoPor.stub);
        assertThat(live.processarNota("cli-003", "vai casar").geradoPor()).isEqualTo(GeradoPor.stub);
    }

    @SuppressWarnings("unchecked")
    private static <E extends Throwable> void lancarSemDeclarar(Throwable t) throws E {
        throw (E) t;
    }

    @Test
    void liveCaiNoStubMesmoComExcecaoCheckedNaoDeclarada() {
        // o AgentInvocation.invoke() do Embabel (Kotlin) propaga ExecutionException sem declará-la
        ExecutorAgentes kotlin = new ExecutorAgentes() {
            @Override public <T> T executar(Object entrada, Class<T> resultado) {
                CopilotoModosTest.<RuntimeException>lancarSemDeclarar(
                        new java.util.concurrent.ExecutionException(new IllegalStateException("401")));
                return null;
            }
        };
        CopilotoLive l = new CopilotoLive(kotlin, stub);

        assertThat(l.redigirMensagem("cli-001", ACAO_FGC, Canal.WHATSAPP).geradoPor()).isEqualTo(GeradoPor.stub);
        assertThat(l.gerarBriefing("cli-001").geradoPor()).isEqualTo(GeradoPor.stub);
    }

    @Test
    void liveNotaInvocaOAgenteDeNota() {
        agentes.resposta = new ResultadoNota("r", List.of(), List.of("m"), List.of(), List.of(), List.of(), List.of(), GeradoPor.live);

        ResultadoNota r = live.processarNota("cli-003", "vai casar");

        assertThat(r.metas()).containsExactly("m");
        assertThat(agentes.entradas).containsExactly(new AgentesTipos.NotaReuniao("cli-003", "vai casar"));
    }

    @Test
    void liveEdicaoInvocaOAgenteEFalhaCaiNasRegrasDoStub() {
        agentes.resposta = new CamposExtraidos(null, "69", null, null, null, GeradoPor.live);

        assertThat(live.extrairEdicao("cli-003", "fez 69 anos").idade()).isEqualTo("69");
        assertThat(agentes.entradas).containsExactly(new AgentesTipos.PedidoEdicao("cli-003", "fez 69 anos"));

        agentes.erro = new IllegalStateException("401 sem chave");
        CamposExtraidos r = live.extrairEdicao("cli-003", "Ela fez 36 anos.");
        assertThat(r.geradoPor()).isEqualTo(GeradoPor.stub);
        assertThat(r.idade()).isEqualTo("36");
    }

    // ---------- record + cache ----------

    @Test
    void recordGravaEdicaoECacheLeOfflinePelaTranscricao() {
        agentes.resposta = new CamposExtraidos(null, null, "Arquiteta", "Campinas/SP", null, GeradoPor.live);
        new CopilotoRecord(live, cache, contextos, null).extrairEdicao("cli-003", "texto do áudio");
        CopilotoCache emCache = new CopilotoCache(cache, contextos, null, stub);

        CamposExtraidos lido = emCache.extrairEdicao("cli-003", "texto do áudio");

        assertThat(lido).isEqualTo(new CamposExtraidos(null, null, "Arquiteta", "Campinas/SP", null, GeradoPor.cache));
        assertThat(emCache.extrairEdicao("cli-003", "outro texto").geradoPor()).isEqualTo(GeradoPor.stub);
        assertThat(agentes.entradas).hasSize(1);   // o cache não chama o agente
    }

    @Test
    void recordGravaECacheLeOffline() throws Exception {
        CopilotoRecord record = new CopilotoRecord(live, cache, contextos, null);
        CopilotoCache emCache = new CopilotoCache(cache, contextos, null, stub);

        record.redigirMensagem("cli-001", ACAO_FGC, Canal.WHATSAPP);
        agentes.resposta = new Briefing("cli-001", List.of("a"), List.of("p"), GeradoPor.live);
        record.gerarBriefing("cli-001");
        try (var arquivos = Files.list(dir)) {
            assertThat(arquivos.map(p -> p.getFileName().toString()))
                    .anyMatch(n -> n.startsWith("mensagem-cli-001-" + ACAO_FGC + "-WHATSAPP-") && n.endsWith(".json"));
        }

        MensagemGerada m = emCache.redigirMensagem("cli-001", ACAO_FGC, Canal.WHATSAPP);

        assertThat(m.texto()).isEqualTo("Oi, Marina! Texto do agente.");
        assertThat(m.geradoPor()).isEqualTo(GeradoPor.cache);
        assertThat(agentes.entradas).hasSize(2);   // o cache não chama o agente
    }

    @Test
    void cacheSemArquivoCaiNoStub() {
        CopilotoCache emCache = new CopilotoCache(cache, contextos, null, stub);

        assertThat(emCache.redigirMensagem("cli-001", ACAO_FGC, Canal.EMAIL).geradoPor()).isEqualTo(GeradoPor.stub);
        assertThat(emCache.gerarBriefing("cli-003").geradoPor()).isEqualTo(GeradoPor.stub);
    }

    @Test
    void chaveDoCacheMudaQuandoOContextoMuda() {
        ContextoCliente marina = contextos.paraCliente("cli-001");
        ContextoCliente juliana = contextos.paraCliente("cli-003");

        assertThat(cache.chave("briefing", marina, null)).isEqualTo(cache.chave("briefing", contextos.paraCliente("cli-001"), null))
                .isNotEqualTo(cache.chave("briefing", juliana, null));
    }

    // ---------- roteador ----------

    private CopilotoRouter router(String modo, String chave) {
        CopilotoProps props = new CopilotoProps(modo, "deepseek/deepseek-v4-pro", dir.toString(), chave, 1024);
        return new CopilotoRouter(props, stub, new CopilotoCache(cache, contextos, null, stub), live, new CopilotoRecord(live, cache, contextos, null));
    }

    @Test
    void roteadorEscolhePeloModo() {
        assertThat(router("stub", "").redigirMensagem("cli-001", ACAO_FGC, Canal.WHATSAPP).geradoPor()).isEqualTo(GeradoPor.stub);
        assertThat(router("live", "sk-teste").redigirMensagem("cli-001", ACAO_FGC, Canal.WHATSAPP).geradoPor()).isEqualTo(GeradoPor.live);
        assertThat(router("cache", "").redigirMensagem("cli-001", ACAO_FGC, Canal.WHATSAPP).geradoPor()).isEqualTo(GeradoPor.stub);
    }

    @Test
    void liveOuRecordSemChaveViramStub() {
        assertThat(router("live", "").redigirMensagem("cli-001", ACAO_FGC, Canal.WHATSAPP).geradoPor()).isEqualTo(GeradoPor.stub);
        assertThat(router("record", null).gerarBriefing("cli-001").geradoPor()).isEqualTo(GeradoPor.stub);
        assertThat(agentes.entradas).isEmpty();
        assertThat(router("live", "").modoEfetivo()).isEqualTo("stub");
    }
}
