package br.com.rotaxp.copiloto.inteligencia;

import static br.com.rotaxp.copiloto.support.CenarioBuilder.REF;
import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotaxp.copiloto.dominio.Diagnostico;
import br.com.rotaxp.copiloto.dominio.Enums.Escopo;
import br.com.rotaxp.copiloto.dominio.Enums.Modalidade;
import br.com.rotaxp.copiloto.dominio.Enums.PerfilInvestidor;
import br.com.rotaxp.copiloto.dominio.Enums.ProdutoDeclarado;
import br.com.rotaxp.copiloto.dominio.Enums.StatusConsentimento;
import br.com.rotaxp.copiloto.dominio.Enums.StatusMissao;
import br.com.rotaxp.copiloto.dominio.Enums.TipoConta;
import br.com.rotaxp.copiloto.dominio.Enums.TipoDiagnostico;
import br.com.rotaxp.copiloto.dominio.Enums.TipoMissao;
import br.com.rotaxp.copiloto.dominio.Enums.TipoTransacao;
import br.com.rotaxp.copiloto.dominio.Jornada;
import br.com.rotaxp.copiloto.dominio.Missao;
import br.com.rotaxp.copiloto.support.CenarioBuilder;
import br.com.rotaxp.copiloto.support.Cenarios;
import br.com.rotaxp.copiloto.support.Infra;
import br.com.rotaxp.copiloto.support.Pilha;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class JornadaServiceTest {

    private final Pilha pilha = new Pilha();
    private final JornadaService service = new JornadaService(Pilha.ALERTAS);

    private Jornada jornada(Infra i, String clienteId) {
        Pilha.Analise a = pilha.analisar(i.gateway.dados(clienteId));
        return service.montar(a.dados(), REF, a.cobertura(), a.principalidade().posicaoXp(), a.fluxo(), a.fgc());
    }

    private static Diagnostico diag(Jornada j, TipoDiagnostico tipo) {
        return j.diagnosticos().stream().filter(d -> d.tipo() == tipo).findFirst().orElseThrow();
    }

    private static Missao missao(Jornada j, TipoMissao tipo) {
        return j.missoes().stream().filter(m -> m.tipo() == tipo).findFirst().orElseThrow();
    }

    @Test
    void marinaAntesEstaNoNivel2ComMissaoDoHorizonte() {
        Jornada j = jornada(new Infra(Cenarios.marina(CenarioBuilder.comInstituicoesPadrao()).build()), "cli-001");

        assertThat(j.completude()).isEqualTo(0.667);
        assertThat(j.nivel().numero()).isEqualTo(2);
        assertThat(j.nivel().nome()).isEqualTo("Visão Clara");
        assertThat(j.nivel().proximo()).isEqualTo("Patrimônio Completo");
        assertThat(j.nivel().comoSubir()).isEqualTo("Conecte o Banco Horizonte para ver 100% do seu patrimônio.");
        assertThat(j.nivel().beneficios()).isNotEmpty();

        assertThat(j.missoes()).singleElement().satisfies(m -> {
            assertThat(m.tipo()).isEqualTo(TipoMissao.CONECTAR_INSTITUICAO);
            assertThat(m.status()).isEqualTo(StatusMissao.DISPONIVEL);
            assertThat(m.instituicaoId()).isEqualTo("inst-horizonte");
            assertThat(m.titulo()).isEqualTo("Conecte o Banco Horizonte e descubra se seu patrimônio está protegido pelo FGC");
            assertThat(m.recompensa()).isEqualTo("Diagnóstico desbloqueado: Proteção FGC");
            assertThat(m.progresso()).isZero();
        });

        assertThat(diag(j, TipoDiagnostico.CUSTO_DE_VIDA).desbloqueado()).isTrue();
        assertThat(diag(j, TipoDiagnostico.RESERVA_EMERGENCIA).desbloqueado()).isTrue();
        assertThat(diag(j, TipoDiagnostico.RESERVA_EMERGENCIA).resumo()).isEqualTo("Sua reserva cobre 6,5 meses do seu custo de vida");
        assertThat(diag(j, TipoDiagnostico.PROTECAO_FGC).desbloqueado()).isFalse();
        assertThat(diag(j, TipoDiagnostico.PROTECAO_FGC).resumo()).isNull();
        assertThat(diag(j, TipoDiagnostico.PROTECAO_FGC).requisito()).isEqualTo("Conecte todas as instituições que você usa");
        assertThat(diag(j, TipoDiagnostico.PATRIMONIO_COMPLETO).desbloqueado()).isFalse();
    }

    @Test
    void marinaDepoisSobeParaONivel3EDesbloqueiaOFgc() {
        Infra i = new Infra(Cenarios.marina(CenarioBuilder.comInstituicoesPadrao()).build());
        i.consentimentos.conceder("cli-001", "inst-horizonte");

        Jornada j = jornada(i, "cli-001");

        assertThat(j.completude()).isEqualTo(1.0);
        assertThat(j.nivel().numero()).isEqualTo(3);
        assertThat(j.nivel().nome()).isEqualTo("Patrimônio Completo");
        assertThat(missao(j, TipoMissao.CONECTAR_INSTITUICAO).status()).isEqualTo(StatusMissao.CONCLUIDA);
        assertThat(missao(j, TipoMissao.CONECTAR_INSTITUICAO).progresso()).isEqualTo(1.0);
        Diagnostico fgc = diag(j, TipoDiagnostico.PROTECAO_FGC);
        assertThat(fgc.desbloqueado()).isTrue();
        assertThat(fgc.resumo()).isEqualTo("R$ 400 mil sem cobertura no Banco Horizonte");
        assertThat(fgc.detalhes()).containsKey("conglomerados");
        assertThat(diag(j, TipoDiagnostico.PATRIMONIO_COMPLETO).resumo()).isEqualTo("R$ 1,6 milhão em 3 instituições");
    }

    @Test
    void julianaTemCustoDeVidaBloqueadoAteConectarOCartao() {
        Infra i = new Infra(Cenarios.juliana(CenarioBuilder.comInstituicoesPadrao()).build());

        Jornada antes = jornada(i, "cli-003");

        assertThat(diag(antes, TipoDiagnostico.CUSTO_DE_VIDA).desbloqueado()).isFalse();
        assertThat(diag(antes, TipoDiagnostico.CUSTO_DE_VIDA).requisito()).isEqualTo("Conecte o cartão do Banco Aurora");
        assertThat(diag(antes, TipoDiagnostico.RESERVA_EMERGENCIA).desbloqueado()).isFalse();
        Missao cartao = missao(antes, TipoMissao.CONECTAR_CARTAO);
        assertThat(cartao.recompensa()).isEqualTo("Diagnóstico desbloqueado: Custo de vida");
        assertThat(missao(antes, TipoMissao.RESERVA_EMERGENCIA).progresso()).isEqualTo(0.5);

        i.consentimentos.conceder("cli-003", "inst-aurora");
        Jornada depois = jornada(i, "cli-003");

        Diagnostico custo = diag(depois, TipoDiagnostico.CUSTO_DE_VIDA);
        assertThat(custo.desbloqueado()).isTrue();
        assertThat(custo.resumo()).isEqualTo("Seu custo de vida é de R$ 9 mil por mês");
        @SuppressWarnings("unchecked")
        Map<String, Object> porCategoria = (Map<String, Object>) custo.detalhes().get("porCategoria");
        assertThat(porCategoria).containsKeys("CARTOES", "CONSUMO");
        assertThat(diag(depois, TipoDiagnostico.RESERVA_EMERGENCIA).resumo()).isEqualTo("Sua reserva cobre 3 meses do seu custo de vida");
    }

    @Test
    void xpPrincipalComTudoConectadoEhNivel4() {
        CenarioBuilder b = CenarioBuilder.comInstituicoesPadrao();
        b.cliente("cli-x", "Fulano", "000", PerfilInvestidor.MODERADO,
                List.of(CenarioBuilder.decl("inst-xp", ProdutoDeclarado.CONTA)), List.of(), List.of()).interno("cli-x");
        String c = b.conta("cli-x", "inst-xp", TipoConta.PAGAMENTO, 5_000);
        b.mensal(c, TipoTransacao.CREDITO, Modalidade.TED, "SALARIO EMPRESA", 8_000, 5, "01", "EMPRESA")
                .debitoMensal(c, "ENERGIA", 300);

        Jornada j = jornada(new Infra(b.build()), "cli-x");

        assertThat(j.nivel().numero()).isEqualTo(4);
        assertThat(j.nivel().nome()).isEqualTo("Cliente Principal");
        assertThat(j.nivel().proximo()).isNull();
    }

    @Test
    void menosDaMetadeConectadaEhNivel1EConsentimentoExpirandoViraMissao() {
        CenarioBuilder b = CenarioBuilder.comInstituicoesPadrao();
        b.cliente("cli-x", "Fulano", "000", PerfilInvestidor.MODERADO,
                List.of(CenarioBuilder.decl("inst-xp", ProdutoDeclarado.INVESTIMENTOS),
                        CenarioBuilder.decl("inst-aurora", ProdutoDeclarado.CONTA),
                        CenarioBuilder.decl("inst-ipe", ProdutoDeclarado.CONTA),
                        CenarioBuilder.decl("inst-horizonte", ProdutoDeclarado.CONTA),
                        CenarioBuilder.decl("inst-aurora-fin", ProdutoDeclarado.INVESTIMENTOS)),
                List.of(), List.of()).interno("cli-x")
                .consentimento("cli-x", "inst-aurora", StatusConsentimento.ATIVO, REF.plusDays(10), Escopo.CONTAS);

        Jornada j = jornada(new Infra(b.build()), "cli-x");

        assertThat(j.completude()).isEqualTo(0.4);
        assertThat(j.nivel().numero()).isEqualTo(1);
        assertThat(j.nivel().nome()).isEqualTo("Explorador");
        Missao renovar = missao(j, TipoMissao.RENOVAR_CONSENTIMENTO);
        assertThat(renovar.instituicaoId()).isEqualTo("inst-aurora");
        assertThat(j.missoes()).filteredOn(m -> m.tipo() == TipoMissao.CONECTAR_INSTITUICAO).hasSize(3);
    }
}
