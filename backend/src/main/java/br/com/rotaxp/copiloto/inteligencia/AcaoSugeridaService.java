package br.com.rotaxp.copiloto.inteligencia;

import br.com.rotaxp.copiloto.analise.AlertaService;
import br.com.rotaxp.copiloto.analise.ResultadoPrioridade;
import br.com.rotaxp.copiloto.analise.Texto;
import br.com.rotaxp.copiloto.config.AlertasProps;
import br.com.rotaxp.copiloto.config.Premissas;
import br.com.rotaxp.copiloto.dominio.AcaoSugerida;
import br.com.rotaxp.copiloto.dominio.Alerta;
import br.com.rotaxp.copiloto.dominio.Cobertura;
import br.com.rotaxp.copiloto.dominio.Cobertura.Pendente;
import br.com.rotaxp.copiloto.dominio.Emissor;
import br.com.rotaxp.copiloto.dominio.Enums.TipoAcao;
import br.com.rotaxp.copiloto.dominio.Enums.TipoEmissor;
import br.com.rotaxp.copiloto.dominio.FluxoCaixa;
import br.com.rotaxp.copiloto.dominio.Instituicao;
import br.com.rotaxp.copiloto.openfinance.DadosVisiveis;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;

/** PLAN §7.8 — próximas melhores ações, uma por alerta + convite para conectar o que falta. */
@Service
public class AcaoSugeridaService {

    private final AlertasProps alertasProps;
    private final Premissas premissas;

    public AcaoSugeridaService(AlertasProps alertasProps, Premissas premissas) {
        this.alertasProps = alertasProps;
        this.premissas = premissas;
    }

    public List<AcaoSugerida> gerar(DadosVisiveis d, List<Alerta> alertas, Cobertura cobertura, FluxoCaixa fluxo,
                                    ResultadoPrioridade prioridade) {
        String cli = d.cliente().id();
        List<Alerta> ordenados = alertas.stream()
                .sorted(Comparator.comparingDouble((Alerta a) -> prioridade.pontosPorAlerta().getOrDefault(a.id(), 0.0)).reversed())
                .toList();

        List<AcaoSugerida> acoes = new ArrayList<>();
        for (Alerta a : ordenados) {
            AcaoSugerida acao = paraAlerta(d, a, fluxo);
            if (acao != null) acoes.add(acao);
        }
        for (Pendente p : cobertura.pendentes()) {
            acoes.add(new AcaoSugerida("acao-" + cli + "-convidar_conexao-" + p.instituicaoId(), cli, TipoAcao.CONVIDAR_CONEXAO,
                    "Convidar a conectar o " + p.nome() + " pelo app",
                    "O cliente declarou o " + p.nome() + ", mas ele ainda não está conectado: a cobertura está em "
                            + Texto.pct(cobertura.percentual()) + ".",
                    "Desbloqueia a visão completa do patrimônio", List.of(), false));
        }
        if (!acoes.isEmpty()) acoes.set(0, acoes.get(0).comoPrincipal(true));
        return List.copyOf(acoes);
    }

    private AcaoSugerida paraAlerta(DadosVisiveis d, Alerta a, FluxoCaixa fluxo) {
        String id = "acao-" + a.id().substring("alr-".length());
        return switch (a.tipo()) {
            case FGC_EXCEDIDO -> acao(id, a, TipoAcao.DIVERSIFICAR_FGC,
                    "Distribuir " + Texto.reais(a.valor()) + " entre emissores para ter 100% de cobertura do FGC",
                    Texto.reais(a.valor()) + " voltam a ter garantia do FGC");
            case CONCENTRACAO_EMISSOR -> acao(id, a, TipoAcao.REDUZIR_CONCENTRACAO,
                    "Reduzir exposição sem garantia " + aoEmissor(d, a), null);
            case SALDO_PARADO -> acao(id, a, TipoAcao.APLICAR_SALDO_PARADO,
                    "Levar " + Texto.reais(a.valor()) + " parados para liquidez diária",
                    "Cerca de " + Texto.reais(AlertaService.rendimentoMensal(a.valor(), premissas)) + " por mês a 100% do CDI");
            case RENDA_FORA_XP -> {
                BigDecimal fracao = alertasProps.aporteProgramadoFracaoSobra();
                BigDecimal aporte = fluxo.capacidadeAporteMensal().multiply(fracao).setScale(-3, RoundingMode.HALF_EVEN);
                yield acao(id, a, TipoAcao.APORTE_PROGRAMADO,
                        "Propor aporte programado de " + Texto.reais(aporte) + "/mês (" + Texto.pct(fracao.doubleValue()) + " da sobra)",
                        Texto.reais(aporte.multiply(BigDecimal.valueOf(12))) + " por ano a mais investidos na XP");
            }
            case VENCIMENTO_PROXIMO -> acao(id, a, TipoAcao.REINVESTIR_VENCIMENTO,
                    a.titulo() + ": preparar reinvestimento", "Evita que o dinheiro fique parado após o vencimento");
            case CONSENTIMENTO_EXPIRANDO -> acao(id, a, TipoAcao.RENOVAR_CONSENTIMENTO,
                    "Lembrar renovação do Open Finance com o " + nomeInstituicao(d, a.instituicaoId()),
                    "Mantém a visão do patrimônio completa");
            case EVENTO_VIDA_PROXIMO -> acao(id, a, TipoAcao.CONTATO_RELACIONAMENTO, a.titulo(), null);
            case RESERVA_INSUFICIENTE -> acao(id, a, TipoAcao.MONTAR_RESERVA,
                    "Completar a reserva: faltam " + Texto.reais(a.valor()),
                    "Reserva de " + Texto.decimal(alertasProps.reservaMesesAlvo()) + " meses do custo de vida");
            case FGC_TETO_GLOBAL -> null;
        };
    }

    private static AcaoSugerida acao(String id, Alerta a, TipoAcao tipo, String titulo, String impacto) {
        return new AcaoSugerida(id, a.clienteId(), tipo, titulo, a.explicacao(), impacto, List.of(a.id()), false);
    }

    private static String aoEmissor(DadosVisiveis d, Alerta a) {
        Emissor e = d.emissor(a.emissorId());
        if (e != null) return (e.tipo() == TipoEmissor.EMPRESA ? "à " : "ao ") + e.nome();
        return "ao " + nomeInstituicao(d, a.instituicaoId());
    }

    private static String nomeInstituicao(DadosVisiveis d, String id) {
        Instituicao i = id == null ? null : d.instituicao(id);
        return i == null ? String.valueOf(id).toLowerCase(Locale.ROOT) : i.nome();
    }
}
