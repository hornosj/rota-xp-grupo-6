package br.com.rotaxp.copiloto.agentes;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotaxp.copiloto.config.CopilotoProps;
import br.com.rotaxp.copiloto.consolidacao.Visao360Assembler;
import br.com.rotaxp.copiloto.dominio.Briefing;
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

    /** LLM falso: grava os prompts recebidos e devolve uma resposta fixa. */
    static class LlmFalso implements LlmCliente {
        final List<String[]> chamadas = new ArrayList<>();
        String resposta = "Oi, Marina! Texto do LLM.";

        @Override public String completar(String system, String user) {
            chamadas.add(new String[] {system, user});
            return resposta;
        }
    }

    @TempDir Path dir;
    private final ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
    private final LlmFalso llm = new LlmFalso();
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
        stub = new CopilotoStub(contextos);
        cache = new CacheLlm(dir, mapper);
        live = new CopilotoLive(contextos, llm, mapper, stub);
    }

    // ---------- live ----------

    @Test
    void liveMandaRegrasNoSystemEContextoEnxutoNoUser() {
        MensagemGerada m = live.redigirMensagem("cli-001", ACAO_FGC, Canal.WHATSAPP);

        assertThat(m.texto()).isEqualTo("Oi, Marina! Texto do LLM.");
        assertThat(m.geradoPor()).isEqualTo(GeradoPor.live);
        String system = llm.chamadas.get(0)[0];
        String user = llm.chamadas.get(0)[1];
        assertThat(system).contains("pt-BR", "Não prometa rentabilidade", "exatamente como estão no contexto", "600 caracteres");
        assertThat(user).contains("R$ 400 mil", "Banco Horizonte", "Aniversário da Sofia", "WHATSAPP")
                .doesNotContain("Juliana", "cli-003");
    }

    @Test
    void liveBriefingLeJsonEstruturado() {
        llm.resposta = "{\"bullets\":[\"a\",\"b\",\"c\",\"d\",\"e\"],\"perguntasSugeridas\":[\"p1\",\"p2\",\"p3\"]}";

        Briefing b = live.gerarBriefing("cli-001");

        assertThat(b.bullets()).containsExactly("a", "b", "c", "d", "e");
        assertThat(b.perguntasSugeridas()).containsExactly("p1", "p2", "p3");
        assertThat(b.geradoPor()).isEqualTo(GeradoPor.live);
    }

    @Test
    void liveComRespostaInvalidaCaiNoStub() {
        llm.resposta = "isso não é json";

        assertThat(live.gerarBriefing("cli-001").geradoPor()).isEqualTo(GeradoPor.stub);
    }

    @Test
    void liveComFalhaDoLlmCaiNoStub() {
        LlmCliente quebrado = (s, u) -> { throw new IllegalStateException("sem rede"); };
        CopilotoLive l = new CopilotoLive(contextos, quebrado, mapper, stub);

        assertThat(l.redigirMensagem("cli-001", ACAO_FGC, Canal.WHATSAPP).geradoPor()).isEqualTo(GeradoPor.stub);
    }

    @Test
    void liveNotaLeFatosEmJson() {
        llm.resposta = "{\"resumo\":\"r\",\"eventos\":[{\"tipo\":\"CASAMENTO\",\"descricao\":\"Casamento\",\"data\":\"2027-05-01\"}],"
                + "\"metas\":[\"m\"],\"mudancasPerfil\":[]}";

        ResultadoNota r = live.processarNota("cli-003", "vai casar");

        assertThat(r.eventosCriados()).singleElement().satisfies(e -> assertThat(e.data()).hasToString("2027-05-01"));
        assertThat(r.metas()).containsExactly("m");
        assertThat(r.geradoPor()).isEqualTo(GeradoPor.live);
    }

    // ---------- record + cache ----------

    @Test
    void recordGravaECacheLeOffline() throws Exception {
        CopilotoRecord record = new CopilotoRecord(live, cache, contextos);
        CopilotoCache emCache = new CopilotoCache(cache, contextos, stub);

        record.redigirMensagem("cli-001", ACAO_FGC, Canal.WHATSAPP);
        record.gerarBriefing("cli-001");
        try (var arquivos = Files.list(dir)) {
            assertThat(arquivos.map(p -> p.getFileName().toString()))
                    .anyMatch(n -> n.startsWith("mensagem-cli-001-" + ACAO_FGC + "-WHATSAPP-") && n.endsWith(".json"));
        }

        MensagemGerada m = emCache.redigirMensagem("cli-001", ACAO_FGC, Canal.WHATSAPP);

        assertThat(m.texto()).isEqualTo("Oi, Marina! Texto do LLM.");
        assertThat(m.geradoPor()).isEqualTo(GeradoPor.cache);
        assertThat(llm.chamadas).hasSize(2);   // o cache não chama o LLM
    }

    @Test
    void cacheSemArquivoCaiNoStub() {
        CopilotoCache emCache = new CopilotoCache(cache, contextos, stub);

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
        CopilotoProps props = new CopilotoProps(modo, "claude-sonnet-5-5", dir.toString(), chave, 1024);
        return new CopilotoRouter(props, stub, new CopilotoCache(cache, contextos, stub), live, new CopilotoRecord(live, cache, contextos));
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
        assertThat(llm.chamadas).isEmpty();
        assertThat(router("live", "").modoEfetivo()).isEqualTo("stub");
    }
}
