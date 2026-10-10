package br.com.rotaxp.copiloto.inteligencia.radar;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotaxp.copiloto.agentes.AgentesTipos.ItemClassificado;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.LoteClassificado;
import br.com.rotaxp.copiloto.agentes.AgentesTipos.LoteNoticias;
import br.com.rotaxp.copiloto.agentes.ExecutorAgentes;
import br.com.rotaxp.copiloto.config.RadarProps;
import br.com.rotaxp.copiloto.dominio.Radar.ImpactoNoticia;
import br.com.rotaxp.copiloto.dominio.Radar.Noticia;
import br.com.rotaxp.copiloto.dominio.Radar.NoticiaClassificada;
import br.com.rotaxp.copiloto.dominio.Radar.OrigemClassificacao;
import br.com.rotaxp.copiloto.dominio.Radar.ResultadoProcessamento;
import br.com.rotaxp.copiloto.support.CenarioBuilder;
import br.com.rotaxp.copiloto.support.Cenarios;
import br.com.rotaxp.copiloto.support.Infra;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.scheduling.support.CronExpression;

public class RadarServiceTest {

    private final ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
    private Infra i;
    private final List<Object> eventos = new ArrayList<>();

    /** Fonte que devolve uma lista mutável (para simular novas notícias chegando). */
    static class FonteManual implements FonteNoticias {
        final List<NoticiaColetada> itens = new ArrayList<>();
        @Override public List<NoticiaColetada> coletar() { return List.copyOf(itens); }
    }

    /** Agente que conta chamadas e classifica tudo como Horizonte. */
    static class AgenteContador implements ExecutorAgentes {
        int chamadas;
        @Override public <T> T executar(Object entrada, Class<T> resultado) {
            chamadas++;
            List<ItemClassificado> itens = ((LoteNoticias) entrada).noticias().stream()
                    .map(n -> new ItemClassificado(n.id(), List.of("emi-horizonte"), List.of(), List.of(), "NEGATIVA", 0.8, "x")).toList();
            return resultado.cast(new LoteClassificado(itens));
        }
    }

    public static RadarProps props(String classificacao) {
        return props(classificacao, false);
    }

    public static RadarProps props(String classificacao, boolean preFiltro) {
        return new RadarProps(classificacao, "openai/gpt-oss-120b", 10, "0 0 7,10,12,14,16,19 * * MON-FRI",
                "0 */30 * * * *", true, true, 0.25, 10, preFiltro);
    }

    private RadarService service(String modo, AgenteContador agente, FonteNoticias... fontes) {
        return service(props(modo), agente, fontes);
    }

    private RadarService service(RadarProps p, AgenteContador agente, FonteNoticias... fontes) {
        return new RadarService(List.of(fontes), new ClassificadorRegras(),
                new ClassificadorLlm(agente, new ClassificadorRegras(), p.modeloClassificacao(), p.tamanhoLote()),
                new CruzamentoCarteira(p.fracaoPlena(), p.pontosMinimos()), i.gateway, i.repo, i.dataReferencia,
                Infra.demoProps(), p, eventos::add);
    }

    @BeforeEach
    void setUp() {
        i = new Infra(Cenarios.juliana(Cenarios.marina(CenarioBuilder.comInstituicoesPadrao())).build());
    }

    @Test
    void processaAsCuradasPeloGabaritoNoModoReferencia() {
        AgenteContador agente = new AgenteContador();
        RadarService s = service("referencia", agente, new FonteCurada(mapper));

        ResultadoProcessamento r = s.processar();

        assertThat(r.coletadas()).isEqualTo(20);
        assertThat(r.novas()).isEqualTo(20);
        assertThat(r.classificadasPorLlm()).isZero();
        assertThat(agente.chamadas).isZero();
        assertThat(s.noticias()).hasSize(20)
                .allMatch(n -> n.classificacao().origem() == OrigemClassificacao.REFERENCIA);
        // mais recentes primeiro
        assertThat(s.noticias().get(0).noticia().id()).isEqualTo("not-020");
        assertThat(eventos).singleElement().isInstanceOf(NoticiasClassificadas.class);
    }

    @Test
    void soClassificaNoticiasNovasEmLotesNoModoLlm() {
        AgenteContador agente = new AgenteContador();
        FonteManual fonte = new FonteManual();
        for (int k = 1; k <= 12; k++) {
            fonte.itens.add(new NoticiaColetada(new Noticia("n" + k, "rss", "Notícia " + k, "", null,
                    OffsetDateTime.parse("2026-10-10T08:00:00-03:00").plusMinutes(k)), null));
        }
        RadarService s = service("llm", agente, fonte);

        ResultadoProcessamento primeira = s.processar();
        assertThat(primeira.novas()).isEqualTo(12);
        assertThat(primeira.lotes()).isEqualTo(2);
        assertThat(primeira.classificadasPorLlm()).isEqualTo(12);
        assertThat(agente.chamadas).isEqualTo(2);

        fonte.itens.add(new NoticiaColetada(new Noticia("n13", "rss", "Notícia 13", "", null,
                OffsetDateTime.parse("2026-10-10T09:00:00-03:00")), null));
        ResultadoProcessamento segunda = s.processar();

        assertThat(segunda.coletadas()).isEqualTo(13);
        assertThat(segunda.novas()).isEqualTo(1);
        assertThat(agente.chamadas).isEqualTo(3);
        assertThat(s.noticias()).hasSize(13);
        assertThat(eventos).hasSize(2);
    }

    @Test
    void semNoticiasNovasNaoPublicaEvento() {
        RadarService s = service("referencia", new AgenteContador(), new FonteCurada(mapper));
        s.processar();
        eventos.clear();

        assertThat(s.processar().novas()).isZero();
        assertThat(eventos).isEmpty();
    }

    /** Agente que registra quais notícias recebeu. */
    static class AgenteQueGuarda extends AgenteContador {
        final List<String> recebidas = new ArrayList<>();
        @Override public <T> T executar(Object entrada, Class<T> resultado) {
            ((LoteNoticias) entrada).noticias().forEach(n -> recebidas.add(n.id()));
            return super.executar(entrada, resultado);
        }
    }

    @Test
    void preFiltroSoMandaAoLlmNoticiasComAlgoFinanceiro() {
        AgenteQueGuarda agente = new AgenteQueGuarda();
        FonteManual fonte = new FonteManual();
        OffsetDateTime t = OffsetDateTime.parse("2026-10-10T08:00:00-03:00");
        fonte.itens.add(new NoticiaColetada(new Noticia("fin", "rss", "Copom eleva a Selic", "", null, t), null));
        fonte.itens.add(new NoticiaColetada(new Noticia("pol", "rss", "Feriado prolongado movimenta rodovias", "", null, t), null));

        ResultadoProcessamento r = service(props("llm", true), agente, fonte).processar();

        assertThat(agente.recebidas).containsExactly("fin");
        assertThat(r.classificadasPorLlm()).isEqualTo(1);
        assertThat(r.classificadasPorRegra()).isEqualTo(1);
    }

    @Test
    void semPreFiltroTudoVaiAoLlm() {
        AgenteQueGuarda agente = new AgenteQueGuarda();
        FonteManual fonte = new FonteManual();
        OffsetDateTime t = OffsetDateTime.parse("2026-10-10T08:00:00-03:00");
        fonte.itens.add(new NoticiaColetada(new Noticia("pol", "rss", "Feriado prolongado movimenta rodovias", "", null, t), null));

        service(props("llm", false), agente, fonte).processar();

        assertThat(agente.recebidas).containsExactly("pol");
    }

    @Test
    void coletaFrequenteGuardaPendentesSemLlmEClassificacaoPegaTudoQueAcumulou() {
        // feed curto que gira (como o do InfoMoney, com 10 itens): 1–10 numa coleta, 6–15 na seguinte
        AgenteContador agente = new AgenteContador();
        FonteManual fonte = new FonteManual();
        OffsetDateTime t = OffsetDateTime.parse("2026-10-10T08:00:00-03:00");
        for (int k = 1; k <= 10; k++) fonte.itens.add(new NoticiaColetada(new Noticia("n" + k, "rss", "Copom e Selic " + k, "", null, t.plusMinutes(k)), null));
        RadarService s = service(props("llm"), agente, fonte);

        assertThat(s.coletar()).isEqualTo(10);
        fonte.itens.subList(0, 5).clear();
        for (int k = 11; k <= 15; k++) fonte.itens.add(new NoticiaColetada(new Noticia("n" + k, "rss", "Copom e Selic " + k, "", null, t.plusMinutes(k)), null));
        assertThat(s.coletar()).isEqualTo(5);

        assertThat(agente.chamadas).isZero();           // coletar não gasta LLM
        assertThat(s.pendentes()).isEqualTo(15);
        assertThat(s.noticias()).isEmpty();

        ResultadoProcessamento r = s.processar();

        assertThat(r.novas()).isEqualTo(15);            // inclui n1–n5, que já tinham saído do feed
        assertThat(r.lotes()).isEqualTo(2);
        assertThat(s.pendentes()).isZero();
        assertThat(s.noticias()).hasSize(15);
    }

    @Test
    void cronDeColetaRodaACada30Minutos() {
        CronExpression cron = CronExpression.parse(props("referencia").cronColeta());
        java.time.ZonedDateTime dia = java.time.ZonedDateTime.parse("2026-10-12T00:00:00-03:00[America/Sao_Paulo]");

        assertThat(execucoes(cron, dia)).isEqualTo(48);
    }

    @Test
    void modoRegrasNaoChamaLlm() {
        AgenteContador agente = new AgenteContador();
        RadarService s = service("regras", agente, new FonteCurada(mapper));

        ResultadoProcessamento r = s.processar();

        assertThat(r.classificadasPorRegra()).isEqualTo(20);
        assertThat(agente.chamadas).isZero();
    }

    @Test
    void impactosDoClienteSeguemOConsentimento() {
        RadarService s = service("referencia", new AgenteContador(), new FonteCurada(mapper));
        s.processar();

        List<String> antes = s.impactosDoCliente("cli-001").stream().map(ImpactoNoticia::noticiaId).toList();
        assertThat(antes).doesNotContain("not-002", "not-020");

        i.consentimentos.conceder("cli-001", "inst-horizonte");
        List<ImpactoNoticia> depois = s.impactosDoCliente("cli-001");

        assertThat(depois.get(0).noticiaId()).isEqualTo("not-002");
        assertThat(depois).extracting(ImpactoNoticia::noticiaId).contains("not-020");
    }

    @Test
    void impactosDaCarteiraJuntaTodosOsClientesPorPontos() {
        RadarService s = service("referencia", new AgenteContador(), new FonteCurada(mapper));
        s.processar();
        i.consentimentos.conceder("cli-001", "inst-horizonte");

        List<ImpactoNoticia> carteira = s.impactosDaCarteira(5);

        assertThat(carteira).hasSizeLessThanOrEqualTo(5);
        assertThat(carteira).extracting(ImpactoNoticia::pontos).isSortedAccordingTo((a, b) -> Double.compare(b, a));
        assertThat(carteira.get(0).clienteId()).isEqualTo("cli-001");
    }

    @Test
    void cronPadraoRodaSeisVezesNumDiaUtilENenhumaNoDomingo() {
        CronExpression cron = CronExpression.parse(props("referencia").cron());
        java.time.ZonedDateTime segunda = java.time.ZonedDateTime.parse("2026-10-12T00:00:00-03:00[America/Sao_Paulo]");
        java.time.ZonedDateTime domingo = java.time.ZonedDateTime.parse("2026-10-11T00:00:00-03:00[America/Sao_Paulo]");

        assertThat(execucoes(cron, segunda)).isEqualTo(6);
        assertThat(execucoes(cron, domingo)).isZero();
    }

    private static int execucoes(CronExpression cron, java.time.ZonedDateTime inicioDoDia) {
        int n = 0;
        java.time.ZonedDateTime t = cron.next(inicioDoDia.minusSeconds(1));
        while (t != null && t.isBefore(inicioDoDia.plusDays(1))) {
            n++;
            t = cron.next(t);
        }
        return n;
    }

    @Test
    void noticiaClassificadaGuardaANoticiaOriginal() {
        RadarService s = service("referencia", new AgenteContador(), new FonteCurada(mapper));
        s.processar();

        NoticiaClassificada n = s.noticias().stream().filter(x -> x.noticia().id().equals("not-001")).findFirst().orElseThrow();

        assertThat(n.noticia().titulo()).startsWith("Agro Sul Sementes adia");
    }
}
